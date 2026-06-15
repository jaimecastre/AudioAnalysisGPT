using System.Numerics;
using AcousticCanvas.Features.Analysis.Domain;
using MathNet.Numerics.IntegralTransforms;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class CpbAnalyzer
{
    private const string WindowType = "hann";
    private const string Averaging = "power";
    private const string Scaling = "one-sided amplitude, coherent-gain corrected";
    private const string Method = "fft_bin_power_sum_nominal_fractional_octave";

    public static CpbAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds,
        string bandMode,
        int fftSize,
        double overlap,
        string weighting = "z"
    )
    {
        var normalizedBandMode = CpbBandBuilder.NormalizeBandMode(bandMode);
        var normalizedWeighting = CpbWeightingCalculator.NormalizeWeighting(weighting);
        var bandsPerOctave = normalizedBandMode == "octave" ? 1 : 3;
        var channelResults = new List<ChannelCpbAnalysis>();

        foreach (var channel in channels)
        {
            channelResults.Add(
                AnalyzeChannel(
                    channel,
                    startSeconds,
                    endSeconds,
                    normalizedBandMode,
                    bandsPerOctave,
                    fftSize,
                    overlap,
                    normalizedWeighting
                )
            );
        }

        var blockCount =
            channels.Count > 0
                ? GetBlockCount(channels[0].SampleRate, startSeconds, endSeconds, fftSize, overlap)
                : 0;

        var sampleRate = channels.Count > 0 ? channels[0].SampleRate : 0;
        return new CpbAnalysis
        {
            Parameters = new CpbParameters
            {
                BandMode = normalizedBandMode,
                BandsPerOctave = bandsPerOctave,
                FftSize = fftSize,
                WindowType = WindowType,
                Overlap = overlap,
                Averaging = Averaging,
                Scaling = Scaling,
                Method = Method,
                Weighting = normalizedWeighting,
                WeightingMethod = CpbWeightingCalculator.GetWeightingMethod(normalizedWeighting),
                Limitations = CpbWeightingCalculator.BuildLimitations(
                    normalizedWeighting,
                    channels.Select(channel => channel.Quantity)
                ),
                StartTimeSeconds = startSeconds,
                EndTimeSeconds = endSeconds,
                BlockCount = blockCount,
                SampleRate = sampleRate,
            },
            Region = new TimeRange
            {
                StartSeconds = startSeconds,
                EndSeconds = endSeconds,
                DurationSeconds = Math.Max(0.0, endSeconds - startSeconds),
            },
            Channels = channelResults,
        };
    }

    /// <summary>
    /// Builds CPB band analysis from a pre-computed spectrum, avoiding a second FFT pass.
    /// Powers are derived as magnitude² per bin, consistent with <see cref="Analyze"/>.
    /// </summary>
    public static CpbAnalysis AnalyzeFromSpectrum(
        SpectrumAnalysis spectrumAnalysis,
        double startSeconds,
        double endSeconds,
        string bandMode,
        int fftSize,
        double overlap,
        int sampleRate,
        string weighting = "z"
    )
    {
        var normalizedBandMode = CpbBandBuilder.NormalizeBandMode(bandMode);
        var normalizedWeighting = CpbWeightingCalculator.NormalizeWeighting(weighting);
        var bandsPerOctave = normalizedBandMode == "octave" ? 1 : 3;
        var nyquistHz = (double)sampleRate / 2.0;
        var channelResults = new List<ChannelCpbAnalysis>();

        foreach (var channelSpectrum in spectrumAnalysis.Channels)
        {
            channelResults.Add(
                AnalyzeChannelFromSpectrum(
                    channelSpectrum,
                    normalizedBandMode,
                    bandsPerOctave,
                    nyquistHz,
                    normalizedWeighting
                )
            );
        }

        return new CpbAnalysis
        {
            Parameters = new CpbParameters
            {
                BandMode = normalizedBandMode,
                BandsPerOctave = bandsPerOctave,
                FftSize = fftSize,
                WindowType = WindowType,
                Overlap = overlap,
                Averaging = Averaging,
                Scaling = Scaling,
                Method = Method,
                Weighting = normalizedWeighting,
                WeightingMethod = CpbWeightingCalculator.GetWeightingMethod(normalizedWeighting),
                Limitations = CpbWeightingCalculator.BuildLimitations(
                    normalizedWeighting,
                    spectrumAnalysis.Channels.Select(channel => channel.Quantity)
                ),
                StartTimeSeconds = startSeconds,
                EndTimeSeconds = endSeconds,
                BlockCount = spectrumAnalysis.Parameters.BlockCount,
                SampleRate = sampleRate,
            },
            Region = new TimeRange
            {
                StartSeconds = startSeconds,
                EndSeconds = endSeconds,
                DurationSeconds = Math.Max(0.0, endSeconds - startSeconds),
            },
            Channels = channelResults,
        };
    }

    private static ChannelCpbAnalysis AnalyzeChannelFromSpectrum(
        ChannelSpectrumAnalysis channelSpectrum,
        string bandMode,
        int bandsPerOctave,
        double nyquistHz,
        string weighting
    )
    {
        var dbReference =
            channelSpectrum.DbReferenceValue.HasValue
            && channelSpectrum.DbReferenceUnit is not null
            && channelSpectrum.DbUnit is not null
                ? new DbReference
                {
                    Value = channelSpectrum.DbReferenceValue.Value,
                    Unit = channelSpectrum.DbReferenceUnit,
                    DbUnit = channelSpectrum.DbUnit,
                }
                : null;

        var bands = CpbBandBuilder.BuildBands(bandMode, bandsPerOctave, nyquistHz);
        var cpbBands = new List<CpbBand>(bands.Count);

        // BS/ISO 7196 "As Signal(s)": A/C weighting only applies to sound-pressure signals.
        var effectiveWeighting = CpbWeightingCalculator.ResolveEffectiveWeighting(
            weighting,
            channelSpectrum.Quantity
        );

        foreach (var band in bands)
        {
            var powerSum = 0.0;
            var binCount = 0;
            for (var i = 1; i < channelSpectrum.FrequenciesHz.Count; i++)
            {
                var frequencyHz = channelSpectrum.FrequenciesHz[i];
                if (frequencyHz < band.LowerFrequencyHz || frequencyHz >= band.UpperFrequencyHz)
                {
                    continue;
                }

                var magnitude = channelSpectrum.Magnitudes[i];
                powerSum += magnitude * magnitude;
                binCount++;
            }

            var unweightedMagnitude = Math.Sqrt(powerSum);
            var weightingCorrectionDb = CpbWeightingCalculator.ComputeWeightingCorrectionDb(
                band.CenterFrequencyHz,
                effectiveWeighting
            );
            var weightedMagnitude =
                unweightedMagnitude * Math.Pow(10.0, weightingCorrectionDb / 20.0);
            var levelDb = ComputeDb(weightedMagnitude, dbReference);

            cpbBands.Add(
                new CpbBand
                {
                    Label = CpbBandBuilder.FormatBandLabel(band.CenterFrequencyHz),
                    CenterFrequencyHz = Math.Round(band.CenterFrequencyHz, 3),
                    LowerFrequencyHz = Math.Round(band.LowerFrequencyHz, 3),
                    UpperFrequencyHz = Math.Round(band.UpperFrequencyHz, 3),
                    PlotLowerFrequencyHz = Math.Round(band.PlotLowerFrequencyHz, 3),
                    PlotUpperFrequencyHz = Math.Round(band.PlotUpperFrequencyHz, 3),
                    Magnitude = Math.Round(weightedMagnitude, 9),
                    LevelDb = levelDb.HasValue ? Math.Round(levelDb.Value, 3) : null,
                    BinCount = binCount,
                }
            );
        }

        return new ChannelCpbAnalysis
        {
            ChannelId = channelSpectrum.ChannelId,
            ChannelName = channelSpectrum.ChannelName,
            Quantity = channelSpectrum.Quantity,
            Unit = channelSpectrum.Unit,
            DbUnit = channelSpectrum.DbUnit,
            Bands = cpbBands,
        };
    }

    private static ChannelCpbAnalysis AnalyzeChannel(
        SignalChannel channel,
        double startSeconds,
        double endSeconds,
        string bandMode,
        int bandsPerOctave,
        int fftSize,
        double overlap,
        string weighting
    )
    {
        var startSample = Math.Clamp(
            (int)Math.Floor(startSeconds * channel.SampleRate),
            0,
            channel.Samples.Length
        );
        var endSample = Math.Clamp(
            (int)Math.Ceiling(endSeconds * channel.SampleRate),
            0,
            channel.Samples.Length
        );
        var spectrum = ComputeAveragedPowerSpectrum(
            channel.Samples,
            startSample,
            endSample,
            channel.SampleRate,
            fftSize,
            overlap
        );
        var bands = CpbBandBuilder.BuildBands(bandMode, bandsPerOctave, channel.SampleRate / 2.0);
        var cpbBands = new List<CpbBand>(bands.Count);

        // BS/ISO 7196 "As Signal(s)": A/C weighting only applies to sound-pressure signals.
        var effectiveWeighting = CpbWeightingCalculator.ResolveEffectiveWeighting(
            weighting,
            channel.Quantity
        );

        foreach (var band in bands)
        {
            var powerSum = 0.0;
            var binCount = 0;
            for (var i = 1; i < spectrum.FrequenciesHz.Length; i++)
            {
                var frequencyHz = spectrum.FrequenciesHz[i];
                if (frequencyHz < band.LowerFrequencyHz || frequencyHz >= band.UpperFrequencyHz)
                {
                    continue;
                }

                powerSum += spectrum.Powers[i];
                binCount++;
            }

            var unweightedMagnitude = Math.Sqrt(powerSum);
            var weightingCorrectionDb = CpbWeightingCalculator.ComputeWeightingCorrectionDb(
                band.CenterFrequencyHz,
                effectiveWeighting
            );
            var weightedMagnitude =
                unweightedMagnitude * Math.Pow(10.0, weightingCorrectionDb / 20.0);
            var levelDb = ComputeDb(weightedMagnitude, channel.DbReference);
            cpbBands.Add(
                new CpbBand
                {
                    Label = CpbBandBuilder.FormatBandLabel(band.CenterFrequencyHz),
                    CenterFrequencyHz = Math.Round(band.CenterFrequencyHz, 3),
                    LowerFrequencyHz = Math.Round(band.LowerFrequencyHz, 3),
                    UpperFrequencyHz = Math.Round(band.UpperFrequencyHz, 3),
                    PlotLowerFrequencyHz = Math.Round(band.PlotLowerFrequencyHz, 3),
                    PlotUpperFrequencyHz = Math.Round(band.PlotUpperFrequencyHz, 3),
                    Magnitude = Math.Round(weightedMagnitude, 9),
                    LevelDb = levelDb.HasValue ? Math.Round(levelDb.Value, 3) : null,
                    BinCount = binCount,
                }
            );
        }

        return new ChannelCpbAnalysis
        {
            ChannelId = channel.Id,
            ChannelName = channel.Name,
            Quantity = channel.Quantity,
            Unit = channel.Unit,
            DbUnit = channel.DbReference?.DbUnit,
            Bands = cpbBands,
        };
    }

    private static SpectrumPowerData ComputeAveragedPowerSpectrum(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        int fftSize,
        double overlap
    )
    {
        var regionLength = endSample - startSample;
        var halfFftSize = fftSize / 2 + 1;
        var window = BuildHannWindow(fftSize);
        var coherentGain = window.Sum() / fftSize;
        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));
        var powerAccumulator = new double[halfFftSize];
        var blockCount = 0;
        var blockStart = startSample;

        do
        {
            var complexBlock = new Complex[fftSize];
            for (var i = 0; i < fftSize; i++)
            {
                var sampleIndex = blockStart + i;
                var sample =
                    regionLength > 0 && sampleIndex < endSample && sampleIndex < samples.Length
                        ? samples[sampleIndex]
                        : 0.0;
                complexBlock[i] = new Complex(sample * window[i], 0.0);
            }

            Fourier.Forward(complexBlock, FourierOptions.NoScaling);

            for (var k = 0; k < halfFftSize; k++)
            {
                var amplitude = complexBlock[k].Magnitude / (fftSize * coherentGain);
                if (k > 0 && k < halfFftSize - 1)
                {
                    amplitude *= 2.0;
                }
                powerAccumulator[k] += amplitude * amplitude;
            }

            blockCount++;
            blockStart += hopSize;
        } while (blockStart + fftSize <= endSample);

        var actualBlockCount = Math.Max(blockCount, 1);
        var frequenciesHz = new double[halfFftSize];
        var powers = new double[halfFftSize];
        for (var k = 0; k < halfFftSize; k++)
        {
            frequenciesHz[k] = (double)k * sampleRate / fftSize;
            powers[k] = powerAccumulator[k] / actualBlockCount;
        }

        return new SpectrumPowerData(frequenciesHz, powers);
    }

    private static double? ComputeDb(double magnitude, DbReference? reference)
    {
        if (reference is null || reference.Value <= 0.0 || magnitude <= 0.0)
        {
            return null;
        }

        return 20.0 * Math.Log10(magnitude / reference.Value);
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

    private static int GetBlockCount(
        int sampleRate,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap
    )
    {
        var startSample = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);
        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));

        if (endSample - startSample <= 0)
        {
            return 1;
        }

        var count = 0;
        var pos = startSample;
        do
        {
            count++;
            pos += hopSize;
        } while (pos + fftSize <= endSample);

        return Math.Max(count, 1);
    }

    private readonly record struct SpectrumPowerData(double[] FrequenciesHz, double[] Powers);
}
