using System.Globalization;
using System.Numerics;
using AcousticCanvas.Features.Analysis.Domain;
using MathNet.Numerics.IntegralTransforms;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class SpectrogramAnalyzer
{
    private const string DefaultWindowType = "hann";

    // Cap frames returned to avoid sending very large JSON payloads over the wire.
    // If the region produces more frames than this, hop size is increased evenly so
    // exactly MaxFrames frames are returned.
    private const int MaxFrames = 1000;

    public static SpectrogramAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        string scale,
        double gainDb,
        double rangeDb,
        double minDbSpl = 20.0,
        double maxDbSpl = 100.0
    )
    {
        scale = SpectrogramAxisBuilder.NormalizeScale(scale);
        gainDb = Math.Clamp(gainDb, -10.0, 30.0);
        rangeDb = Math.Clamp(rangeDb, 20.0, 120.0);
        minDbSpl = Math.Clamp(minDbSpl, -120.0, 120.0);
        maxDbSpl = Math.Clamp(maxDbSpl, minDbSpl + 1.0, 200.0);
        var firstChannel = channels[0];
        var sampleRate = firstChannel.SampleRate;
        var binCount = fftSize / 2 + 1;

        var durationSeconds = (double)firstChannel.Samples.Length / sampleRate;
        var clampedStartSeconds = Math.Clamp(startSeconds, 0.0, durationSeconds);
        var clampedEndSeconds = Math.Clamp(endSeconds, clampedStartSeconds, durationSeconds);

        var startSample = (int)Math.Floor(clampedStartSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(clampedEndSeconds * sampleRate);

        var regionLength = endSample - startSample;
        var nominalHopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));

        // Count how many frames the nominal hop would produce.
        var nominalFrameCount = CountFrames(regionLength, fftSize, nominalHopSize);

        // Increase hop size if we would exceed MaxFrames.
        var actualHopSize = nominalHopSize;
        if (nominalFrameCount > MaxFrames)
        {
            actualHopSize = (int)Math.Ceiling((double)regionLength / MaxFrames);
        }

        var window = BuildHannWindow(fftSize);
        var coherentGain = ComputeCoherentGain(window, fftSize);

        var channelResults = new List<ChannelSpectrogramAnalysis>();

        foreach (var channel in channels)
        {
            var channelResult = AnalyzeChannel(
                channel,
                startSample,
                endSample,
                fftSize,
                actualHopSize,
                binCount,
                window,
                coherentGain,
                sampleRate,
                scale,
                gainDb,
                rangeDb,
                minDbSpl,
                maxDbSpl
            );

            channelResults.Add(channelResult);
        }

        var actualFrameCount = channelResults.Count > 0 ? channelResults[0].FrameCount : 0;

        var parameters = new SpectrogramParameters
        {
            FftSize = fftSize,
            WindowType = DefaultWindowType,
            Overlap = overlap,
            Scale = scale,
            GainDb = gainDb,
            RangeDb = rangeDb,
            StartTimeSeconds = clampedStartSeconds,
            EndTimeSeconds = clampedEndSeconds,
            FrameCount = actualFrameCount,
            BinCount = binCount,
            SampleRate = sampleRate,
            MinDbSpl = minDbSpl,
            MaxDbSpl = maxDbSpl,
        };

        var region = new TimeRange
        {
            StartSeconds = clampedStartSeconds,
            EndSeconds = clampedEndSeconds,
            DurationSeconds = clampedEndSeconds - clampedStartSeconds,
        };

        var timeAxisTicks = SpectrogramAxisBuilder.BuildTimeAxisTicks(clampedStartSeconds, clampedEndSeconds, 6);
        var frequencyAxisTicks = SpectrogramAxisBuilder.BuildFrequencyAxisTicks(sampleRate / 2.0, scale, 6);

        return new SpectrogramAnalysis
        {
            Parameters = parameters,
            Region = region,
            Channels = channelResults,
            TimeAxisTicks = timeAxisTicks,
            FrequencyAxisTicks = frequencyAxisTicks,
        };
    }

    private static ChannelSpectrogramAnalysis AnalyzeChannel(
        SignalChannel channel,
        int startSample,
        int endSample,
        int fftSize,
        int hopSize,
        int binCount,
        double[] window,
        double coherentGain,
        int sampleRate,
        string scale,
        double gainDb,
        double rangeDb,
        double minDbSpl,
        double maxDbSpl
    )
    {
        var samples = channel.Samples;
        var frames = new List<double[]>();

        var blockStart = startSample;
        while (blockStart + fftSize <= endSample)
        {
            var amplitudes = ComputeFrameAmplitudes(
                samples,
                blockStart,
                fftSize,
                window,
                coherentGain
            );
            frames.Add(SpectrogramAxisBuilder.RemapFrequencyScale(amplitudes, scale, sampleRate / 2.0));
            blockStart += hopSize;
        }

        // Always include at least one frame even for very short regions.
        if (frames.Count == 0)
        {
            var amplitudes = ComputeFrameAmplitudes(
                samples,
                startSample,
                fftSize,
                window,
                coherentGain
            );
            frames.Add(SpectrogramAxisBuilder.RemapFrequencyScale(amplitudes, scale, sampleRate / 2.0));
        }

        // All channels use the dB SPL path: Pa or digital with 0 dBFS = 91 dB SPL convention.
        // GetScaleFactor returns 1.0 for PressurePascal and DigitalFullScale.
        var scaleFactor = channel.PhysicalMetadata != null
            ? AcousticPressureConverter.GetScaleFactor(channel.PhysicalMetadata)
            : 1.0;

        var frequencyData = new List<byte[]>();

        foreach (var frame in frames)
        {
            var frameBytes = new byte[binCount];
            for (var k = 0; k < binCount; k++)
            {
                var peakAmplitudePa = frame[k] * scaleFactor;
                var dbSpl = AcousticPressureConverter.ComputeDbSplFromPeakAmplitude(
                    peakAmplitudePa
                );
                frameBytes[k] = AcousticPressureConverter.MapDbSplToByte(
                    dbSpl,
                    minDbSpl,
                    maxDbSpl
                );
            }
            frequencyData.Add(frameBytes);
        }

        return new ChannelSpectrogramAnalysis
        {
            ChannelId = channel.Id,
            ChannelName = channel.Name,
            BinCount = binCount,
            FrameCount = frames.Count,
            NyquistHz = sampleRate / 2.0,
            FrequencyData = frequencyData,
            ColorbandLabel = AcousticPressureConverter.ResolveColorbandLabel(
                channel.PhysicalMetadata
            ),
            CalibrationState = AcousticPressureConverter.ResolveCalibrationState(
                channel.PhysicalMetadata
            ),
        };
    }

    private static double[] ComputeFrameAmplitudes(
        float[] samples,
        int blockStart,
        int fftSize,
        double[] window,
        double coherentGain
    )
    {
        var complexBlock = new Complex[fftSize];
        var available = Math.Max(0, Math.Min(fftSize, samples.Length - blockStart));

        for (var i = 0; i < fftSize; i++)
        {
            var sampleValue = i < available ? (double)samples[blockStart + i] : 0.0;
            complexBlock[i] = new Complex(sampleValue * window[i], 0.0);
        }

        Fourier.Forward(complexBlock, FourierOptions.NoScaling);

        var binCount = fftSize / 2 + 1;
        var amplitudes = new double[binCount];

        for (var k = 0; k < binCount; k++)
        {
            var rawMagnitude = complexBlock[k].Magnitude;
            var amplitude = rawMagnitude / (fftSize * coherentGain);

            // Double non-DC, non-Nyquist bins to correct one-sided spectrum.
            if (k > 0 && k < binCount - 1)
            {
                amplitude *= 2.0;
            }

            amplitudes[k] = amplitude;
        }

        return amplitudes;
    }


    private static double[] BuildHannWindow(int size)
    {
        var window = new double[size];
        for (var n = 0; n < size; n++)
        {
            window[n] = 0.5 * (1.0 - Math.Cos(2.0 * Math.PI * n / size));
        }
        return window;
    }

    private static double ComputeCoherentGain(double[] window, int fftSize)
    {
        var sum = 0.0;
        for (var i = 0; i < fftSize; i++)
        {
            sum += window[i];
        }
        return sum / fftSize;
    }

    private static int CountFrames(int regionLength, int fftSize, int hopSize)
    {
        if (regionLength <= 0)
        {
            return 0;
        }

        var count = 0;
        var pos = 0;
        while (pos + fftSize <= regionLength)
        {
            count++;
            pos += hopSize;
        }
        return Math.Max(count, 1);
    }
}
