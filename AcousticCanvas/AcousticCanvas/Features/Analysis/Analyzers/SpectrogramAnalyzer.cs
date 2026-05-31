using MathNet.Numerics.IntegralTransforms;
using AcousticCanvas.Features.Analysis.Domain;
using System.Numerics;

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
        double rangeDb)
    {
        scale = NormalizeScale(scale);
        gainDb = Math.Clamp(gainDb, -10.0, 30.0);
        rangeDb = Math.Clamp(rangeDb, 20.0, 120.0);
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
                rangeDb);

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
        };

        var region = new TimeRange
        {
            StartSeconds = clampedStartSeconds,
            EndSeconds = clampedEndSeconds,
            DurationSeconds = clampedEndSeconds - clampedStartSeconds,
        };

        return new SpectrogramAnalysis
        {
            Parameters = parameters,
            Region = region,
            Channels = channelResults,
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
        double rangeDb)
    {
        var samples = channel.Samples;
        var frames = new List<double[]>();

        var blockStart = startSample;
        while (blockStart + fftSize <= endSample)
        {
            var amplitudes = ComputeFrameAmplitudes(samples, blockStart, fftSize, window, coherentGain);
            frames.Add(RemapFrequencyScale(amplitudes, scale, sampleRate / 2.0));
            blockStart += hopSize;
        }

        // Always include at least one frame even for very short regions.
        if (frames.Count == 0)
        {
            var amplitudes = ComputeFrameAmplitudes(samples, startSample, fftSize, window, coherentGain);
            frames.Add(RemapFrequencyScale(amplitudes, scale, sampleRate / 2.0));
        }

        // Find global max amplitude across all frames for normalisation.
        var globalMaxAmplitude = 0.0;
        foreach (var frame in frames)
        {
            foreach (var amplitude in frame)
            {
                if (amplitude > globalMaxAmplitude)
                {
                    globalMaxAmplitude = amplitude;
                }
            }
        }

        // Normalise each amplitude to 0-255 using dB scale relative to global max.
        // This matches what wavesurfer's SpectrogramPlugin expects: Uint8Array[][] where
        // 255 = loudest, 0 = silence / below floor.
        // Dynamic range window: 0 dB at peak, -gainDB dB at floor.
        var floorDb = -(gainDb + rangeDb);

        var frequencyData = new List<byte[]>();

        foreach (var frame in frames)
        {
            var frameBytes = new byte[binCount];
            for (var k = 0; k < binCount; k++)
            {
                double byteValue;

                if (globalMaxAmplitude <= 0.0 || frame[k] <= 0.0)
                {
                    byteValue = 0.0;
                }
                else
                {
                    var db = 20.0 * Math.Log10(frame[k] / globalMaxAmplitude) + gainDb;
                    var normalised = (db - floorDb) / (gainDb - floorDb);
                    byteValue = Math.Clamp(normalised * 255.0, 0.0, 255.0);
                }

                frameBytes[k] = (byte)Math.Round(byteValue);
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
        };
    }

    private static double[] ComputeFrameAmplitudes(
        float[] samples,
        int blockStart,
        int fftSize,
        double[] window,
        double coherentGain)
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
            window[n] = 0.5 * (1.0 - Math.Cos(2.0 * Math.PI * n / (size - 1)));
        }
        return window;
    }

    private static double[] RemapFrequencyScale(double[] amplitudes, string scale, double nyquistHz)
    {
        if (scale == "linear")
        {
            return amplitudes;
        }

        var remapped = new double[amplitudes.Length];
        var maxIndex = amplitudes.Length - 1;
        var maxScaledFrequency = FrequencyToScale(nyquistHz, scale);

        for (var index = 0; index < amplitudes.Length; index++)
        {
            var scaledFraction = maxIndex == 0 ? 0.0 : (double)index / maxIndex;
            var sourcePosition = ScaleToFrequency(scaledFraction * maxScaledFrequency, scale) / nyquistHz * maxIndex;
            sourcePosition = Math.Clamp(sourcePosition, 0.0, maxIndex);
            var lowerIndex = (int)Math.Floor(sourcePosition);
            var upperIndex = Math.Min(lowerIndex + 1, maxIndex);
            var interpolation = sourcePosition - lowerIndex;
            remapped[index] = amplitudes[lowerIndex] * (1.0 - interpolation) + amplitudes[upperIndex] * interpolation;
        }

        return remapped;
    }

    private static double FrequencyToScale(double frequencyHz, string scale) =>
        scale switch
        {
            "mel" => 2595.0 * Math.Log10(1.0 + frequencyHz / 700.0),
            "logarithmic" => Math.Log10(1.0 + frequencyHz),
            _ => frequencyHz,
        };

    private static double ScaleToFrequency(double scaledFrequency, string scale) =>
        scale switch
        {
            "mel" => 700.0 * (Math.Pow(10.0, scaledFrequency / 2595.0) - 1.0),
            "logarithmic" => Math.Pow(10.0, scaledFrequency) - 1.0,
            _ => scaledFrequency,
        };

    private static string NormalizeScale(string scale) =>
        (scale ?? string.Empty).ToLowerInvariant() switch
        {
            "linear" => "linear",
            "logarithmic" => "logarithmic",
            _ => "mel",
        };

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
