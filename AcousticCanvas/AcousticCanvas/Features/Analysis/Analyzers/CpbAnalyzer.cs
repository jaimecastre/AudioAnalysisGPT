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
    private static readonly double[] OctaveCentersHz = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    private static readonly double[] ThirdOctaveCentersHz =
    [
        20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
        630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
        10000, 12500, 16000, 20000
    ];

    public static CpbAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds,
        string bandMode,
        int fftSize,
        double overlap,
        string weighting = "z")
    {
        var normalizedBandMode = NormalizeBandMode(bandMode);
        var normalizedWeighting = NormalizeWeighting(weighting);
        var bandsPerOctave = normalizedBandMode == "octave" ? 1 : 3;
        var channelResults = new List<ChannelCpbAnalysis>();

        foreach (var channel in channels)
        {
            channelResults.Add(AnalyzeChannel(channel, startSeconds, endSeconds, normalizedBandMode, bandsPerOctave, fftSize, overlap, normalizedWeighting));
        }

        var blockCount = channels.Count > 0
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
                WeightingMethod = GetWeightingMethod(normalizedWeighting),
                Limitations =
                [
                    "Nominal fractional-octave bands computed by summing FFT-bin power; not an IEC 61260 filter-bank analysis.",
                ],
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

    private static ChannelCpbAnalysis AnalyzeChannel(
        SignalChannel channel,
        double startSeconds,
        double endSeconds,
        string bandMode,
        int bandsPerOctave,
        int fftSize,
        double overlap,
        string weighting)
    {
        var startSample = Math.Clamp((int)Math.Floor(startSeconds * channel.SampleRate), 0, channel.Samples.Length);
        var endSample = Math.Clamp((int)Math.Ceiling(endSeconds * channel.SampleRate), 0, channel.Samples.Length);
        var spectrum = ComputeAveragedPowerSpectrum(channel.Samples, startSample, endSample, channel.SampleRate, fftSize, overlap);
        var bands = BuildBands(bandMode, bandsPerOctave, channel.SampleRate / 2.0);
        var cpbBands = new List<CpbBand>(bands.Count);

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
            var weightingCorrectionDb = ComputeWeightingCorrectionDb(band.CenterFrequencyHz, weighting);
            var weightedMagnitude = unweightedMagnitude * Math.Pow(10.0, weightingCorrectionDb / 20.0);
            var levelDb = ComputeDb(weightedMagnitude, channel.DbReference);
            cpbBands.Add(new CpbBand
            {
                Label = FormatBandLabel(band.CenterFrequencyHz),
                CenterFrequencyHz = Math.Round(band.CenterFrequencyHz, 3),
                LowerFrequencyHz = Math.Round(band.LowerFrequencyHz, 3),
                UpperFrequencyHz = Math.Round(band.UpperFrequencyHz, 3),
                Magnitude = Math.Round(weightedMagnitude, 9),
                LevelDb = levelDb.HasValue ? Math.Round(levelDb.Value, 3) : null,
                BinCount = binCount,
            });
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
        double overlap)
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
                var sample = regionLength > 0 && sampleIndex < endSample && sampleIndex < samples.Length ? samples[sampleIndex] : 0.0;
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
        }
        while (blockStart + fftSize <= endSample);

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

    private static IReadOnlyList<CpbBandDefinition> BuildBands(string bandMode, int bandsPerOctave, double nyquistHz)
    {
        var centers = bandMode == "octave" ? OctaveCentersHz : ThirdOctaveCentersHz;
        var edgeRatio = Math.Pow(2.0, 1.0 / (2.0 * bandsPerOctave));
        return centers
            .Select(center => new CpbBandDefinition(center, center / edgeRatio, center * edgeRatio))
            .Where(band => band.UpperFrequencyHz >= 20.0 && band.LowerFrequencyHz < nyquistHz)
            .ToArray();
    }

    private static string NormalizeBandMode(string bandMode)
    {
        return bandMode.Equals("octave", StringComparison.OrdinalIgnoreCase) ? "octave" : "third_octave";
    }

    private static string NormalizeWeighting(string weighting)
    {
        if (weighting.Equals("a", StringComparison.OrdinalIgnoreCase))
        {
            return "a";
        }

        if (weighting.Equals("c", StringComparison.OrdinalIgnoreCase))
        {
            return "c";
        }

        return "z";
    }

    private static string GetWeightingMethod(string weighting)
    {
        return weighting switch
        {
            "a" => "A-weighting IEC 61672 nominal frequency response",
            "c" => "C-weighting IEC 61672 nominal frequency response",
            _ => "Z-weighting unweighted flat response",
        };
    }

    private static double ComputeWeightingCorrectionDb(double frequencyHz, string weighting)
    {
        return weighting switch
        {
            "a" => ComputeAWeightingCorrectionDb(frequencyHz),
            "c" => ComputeCWeightingCorrectionDb(frequencyHz),
            _ => 0.0,
        };
    }

    private static double ComputeAWeightingCorrectionDb(double frequencyHz)
    {
        if (frequencyHz <= 0.0)
        {
            return double.NegativeInfinity;
        }

        var frequencySquared = frequencyHz * frequencyHz;
        var numerator = Math.Pow(12200.0, 2.0) * frequencySquared * frequencySquared;
        var denominator = (frequencySquared + Math.Pow(20.6, 2.0))
            * Math.Sqrt((frequencySquared + Math.Pow(107.7, 2.0)) * (frequencySquared + Math.Pow(737.9, 2.0)))
            * (frequencySquared + Math.Pow(12200.0, 2.0));

        return 20.0 * Math.Log10(numerator / denominator) + 2.0;
    }

    private static double ComputeCWeightingCorrectionDb(double frequencyHz)
    {
        if (frequencyHz <= 0.0)
        {
            return double.NegativeInfinity;
        }

        var frequencySquared = frequencyHz * frequencyHz;
        var numerator = Math.Pow(12200.0, 2.0) * frequencySquared;
        var denominator = (frequencySquared + Math.Pow(20.6, 2.0)) * (frequencySquared + Math.Pow(12200.0, 2.0));

        return 20.0 * Math.Log10(numerator / denominator) + 0.06;
    }

    private static double? ComputeDb(double magnitude, DbReference? reference)
    {
        if (reference is null || reference.Value <= 0.0 || magnitude <= 0.0)
        {
            return null;
        }

        return 20.0 * Math.Log10(magnitude / reference.Value);
    }

    private static string FormatBandLabel(double frequencyHz)
    {
        return frequencyHz >= 1000.0
            ? $"{frequencyHz / 1000.0:0.##}k"
            : $"{frequencyHz:0.##}";
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

    private static int GetBlockCount(int sampleRate, double startSeconds, double endSeconds, int fftSize, double overlap)
    {
        var regionLength = (int)Math.Ceiling(endSeconds * sampleRate) - (int)Math.Floor(startSeconds * sampleRate);
        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));
        if (regionLength <= 0)
        {
            return 1;
        }

        var count = 0;
        var pos = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);
        do
        {
            count++;
            pos += hopSize;
        }
        while (pos + fftSize <= endSample);

        return Math.Max(count, 1);
    }

    private readonly record struct SpectrumPowerData(double[] FrequenciesHz, double[] Powers);
    private readonly record struct CpbBandDefinition(double CenterFrequencyHz, double LowerFrequencyHz, double UpperFrequencyHz);
}
