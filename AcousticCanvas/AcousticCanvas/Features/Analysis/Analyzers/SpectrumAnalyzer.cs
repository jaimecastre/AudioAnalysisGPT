using MathNet.Numerics.IntegralTransforms;
using AcousticCanvas.Features.Analysis.Domain;
using System.Numerics;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class SpectrumAnalyzer
{
    private const string DefaultWindowType = "hann";
    private const string AveragingMethod = "power";
    private const string ScalingDescription = "one-sided amplitude, coherent-gain corrected";
    private const string TonalPeakMethod = "local_median_prominence_db";
    private const double MinimumTonalPeakFrequencyHz = 20.0;
    private const double MinimumReportedProminenceDb = 9.0;
    private const double HighConfidenceProminenceDb = 12.0;
    private const int MaxTonalPeaks = 5;

    public static SpectrumAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap)
    {
        var channelResults = new List<ChannelSpectrumAnalysis>();

        foreach (var channel in channels)
        {
            var channelResult = AnalyzeChannel(channel, startSeconds, endSeconds, fftSize, overlap);
            channelResults.Add(channelResult);
        }

        // Use block count from first channel (all channels share the same time region and sample rate).
        var blockCount = channelResults.Count > 0
            ? GetBlockCount(channels[0].SampleRate, startSeconds, endSeconds, fftSize, overlap)
            : 0;

        var parameters = new SpectrumParameters
        {
            FftSize = fftSize,
            WindowType = DefaultWindowType,
            Overlap = overlap,
            Averaging = AveragingMethod,
            Scaling = ScalingDescription,
            StartTimeSeconds = startSeconds,
            EndTimeSeconds = endSeconds,
            BlockCount = blockCount,
        };

        var region = new TimeRange
        {
            StartSeconds = startSeconds,
            EndSeconds = endSeconds,
            DurationSeconds = Math.Max(0.0, endSeconds - startSeconds),
        };

        return new SpectrumAnalysis
        {
            Channels = channelResults,
            Parameters = parameters,
            Region = region,
        };
    }

    private static ChannelSpectrumAnalysis AnalyzeChannel(
        SignalChannel channel,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap)
    {
        var sampleRate = channel.SampleRate;
        var samples = channel.Samples;

        var startSample = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);

        startSample = Math.Clamp(startSample, 0, samples.Length);
        endSample = Math.Clamp(endSample, 0, samples.Length);

        var spectrumData = ComputeAveragedSpectrum(samples, startSample, endSample, sampleRate, fftSize, overlap);

        if (channel.DbReference != null)
        {
            ApplyDbReferenceInPlace(spectrumData.Magnitudes, spectrumData.MagnitudesDb, channel.DbReference);
        }

        // Find peak bin, then apply quadratic interpolation for sub-bin frequency accuracy.
        double? maxMagnitude = null;
        double? maxMagnitudeDb = null;
        double? peakFrequencyHz = null;
        var peakBinIndex = -1;

        for (var i = 0; i < spectrumData.FrequenciesHz.Length; i++)
        {
            if (maxMagnitude == null || spectrumData.Magnitudes[i] > maxMagnitude.Value)
            {
                maxMagnitude = spectrumData.Magnitudes[i];
                maxMagnitudeDb = spectrumData.MagnitudesDb[i];
                peakFrequencyHz = spectrumData.FrequenciesHz[i];
                peakBinIndex = i;
            }
        }

        if (peakBinIndex > 0 && peakBinIndex < spectrumData.FrequenciesHz.Length - 1)
        {
            var interpolatedHz = QuadraticInterpolateFrequencyHz(
                spectrumData.Magnitudes,
                spectrumData.FrequenciesHz,
                peakBinIndex);
            if (interpolatedHz.HasValue)
            {
                peakFrequencyHz = interpolatedHz.Value;
            }
        }

        var tonalPeaks = DetectTonalPeaks(spectrumData.FrequenciesHz, spectrumData.Magnitudes, spectrumData.MagnitudesDb);

        return new ChannelSpectrumAnalysis
        {
            ChannelId = channel.Id,
            ChannelName = channel.Name,
            Quantity = channel.Quantity,
            Unit = channel.Unit,
            FrequenciesHz = spectrumData.FrequenciesHz,
            Magnitudes = spectrumData.Magnitudes,
            MagnitudesDb = spectrumData.MagnitudesDb,
            MaxMagnitude = maxMagnitude.HasValue ? Math.Round(maxMagnitude.Value, 6) : null,
            MaxMagnitudeDb = maxMagnitudeDb.HasValue ? Math.Round(maxMagnitudeDb.Value, 3) : null,
            PeakFrequencyHz = peakFrequencyHz.HasValue ? Math.Round(peakFrequencyHz.Value, 3) : null,
            TonalPeaks = tonalPeaks,
            DbUnit = channel.DbReference?.DbUnit,
            DbReferenceValue = channel.DbReference?.Value,
            DbReferenceUnit = channel.DbReference?.Unit,
        };
    }

    private static IReadOnlyList<TonalPeak> DetectTonalPeaks(
        IReadOnlyList<double> frequenciesHz,
        IReadOnlyList<double> magnitudes,
        IReadOnlyList<double?> magnitudesDb)
    {
        if (frequenciesHz.Count < 5 || magnitudes.Count != frequenciesHz.Count || magnitudesDb.Count != frequenciesHz.Count)
        {
            return [];
        }

        var dbValues = BuildDbValues(magnitudes, magnitudesDb);
        var binSpacingHz = frequenciesHz.Count > 1 ? frequenciesHz[1] - frequenciesHz[0] : 0.0;
        if (binSpacingHz <= 0)
        {
            return [];
        }

        var candidates = new List<TonalPeak>();
        for (var i = 1; i < dbValues.Length - 1; i++)
        {
            if (frequenciesHz[i] < MinimumTonalPeakFrequencyHz)
            {
                continue;
            }

            if (!IsFinite(dbValues[i]) || dbValues[i] <= dbValues[i - 1] || dbValues[i] < dbValues[i + 1])
            {
                continue;
            }

            var localFloor = EstimateLocalFloorDb(dbValues, i, binSpacingHz);
            if (localFloor is null)
            {
                continue;
            }

            var prominenceDb = dbValues[i] - localFloor.Value;
            if (prominenceDb < MinimumReportedProminenceDb)
            {
                continue;
            }

            var bandwidthHz = EstimatePeakBandwidthHz(dbValues, frequenciesHz, i, dbValues[i] - 3.0);
            var confidence = prominenceDb >= HighConfidenceProminenceDb && IsNarrowPeak(frequenciesHz[i], bandwidthHz)
                ? "high"
                : "medium";

            var interpolatedPeakHz = QuadraticInterpolateFrequencyHz(magnitudes, frequenciesHz, i)
                ?? frequenciesHz[i];

            candidates.Add(new TonalPeak
            {
                FrequencyHz = Math.Round(interpolatedPeakHz, 3),
                MagnitudeDb = Math.Round(dbValues[i], 3),
                LocalFloorDb = Math.Round(localFloor.Value, 3),
                ProminenceDb = Math.Round(prominenceDb, 3),
                BandwidthHz = Math.Round(bandwidthHz, 3),
                Confidence = confidence,
                Method = TonalPeakMethod,
            });
        }

        return candidates
            .OrderByDescending(peak => peak.ProminenceDb)
            .ThenByDescending(peak => peak.MagnitudeDb)
            .Take(MaxTonalPeaks)
            .ToArray();
    }

    private static double[] BuildDbValues(IReadOnlyList<double> magnitudes, IReadOnlyList<double?> magnitudesDb)
    {
        var dbValues = new double[magnitudes.Count];
        for (var i = 0; i < magnitudes.Count; i++)
        {
            if (magnitudesDb[i].HasValue)
            {
                dbValues[i] = magnitudesDb[i]!.Value;
            }
            else if (magnitudes[i] > 0)
            {
                dbValues[i] = 20.0 * Math.Log10(magnitudes[i]);
            }
            else
            {
                dbValues[i] = double.NegativeInfinity;
            }
        }
        return dbValues;
    }

    private static double? EstimateLocalFloorDb(double[] dbValues, int peakIndex, double binSpacingHz)
    {
        var halfWindowBins = Math.Clamp((int)Math.Round(300.0 / binSpacingHz), 12, 120);
        var guardBins = Math.Clamp((int)Math.Round(35.0 / binSpacingHz), 2, 12);
        var start = Math.Max(0, peakIndex - halfWindowBins);
        var end = Math.Min(dbValues.Length - 1, peakIndex + halfWindowBins);
        var localValues = new List<double>(end - start + 1);

        for (var i = start; i <= end; i++)
        {
            if (Math.Abs(i - peakIndex) <= guardBins || !IsFinite(dbValues[i]))
            {
                continue;
            }
            localValues.Add(dbValues[i]);
        }

        if (localValues.Count < 6)
        {
            return null;
        }

        localValues.Sort();
        var middle = localValues.Count / 2;
        if (localValues.Count % 2 == 1)
        {
            return localValues[middle];
        }

        return (localValues[middle - 1] + localValues[middle]) / 2.0;
    }

    private static double EstimatePeakBandwidthHz(
        double[] dbValues,
        IReadOnlyList<double> frequenciesHz,
        int peakIndex,
        double thresholdDb)
    {
        var leftIndex = peakIndex;
        while (leftIndex > 0 && dbValues[leftIndex] > thresholdDb)
        {
            leftIndex--;
        }

        var rightIndex = peakIndex;
        while (rightIndex < dbValues.Length - 1 && dbValues[rightIndex] > thresholdDb)
        {
            rightIndex++;
        }

        return Math.Max(0.0, frequenciesHz[rightIndex] - frequenciesHz[leftIndex]);
    }

    private static bool IsNarrowPeak(double frequencyHz, double bandwidthHz)
    {
        var maximumNarrowBandwidthHz = Math.Max(80.0, frequencyHz * 0.05);
        return bandwidthHz <= maximumNarrowBandwidthHz;
    }

    private static bool IsFinite(double value)
    {
        return !double.IsNaN(value) && !double.IsInfinity(value);
    }

    /// <summary>
    /// Parabolic interpolation in log-magnitude (dB) domain around <paramref name="peakIndex"/>.
    /// The Hann window main lobe is approximately parabolic in dB, so this gives significantly
    /// better sub-bin frequency accuracy for sinusoids than linear-magnitude interpolation.
    /// Falls back to linear magnitude if any neighbour is zero or negative.
    /// Returns the interpolated frequency in Hz, or null if neighbours are invalid.
    /// </summary>
    private static double? QuadraticInterpolateFrequencyHz(
        IReadOnlyList<double> magnitudes,
        IReadOnlyList<double> frequenciesHz,
        int peakIndex)
    {
        if (peakIndex <= 0 || peakIndex >= magnitudes.Count - 1)
        {
            return null;
        }

        var magLeft   = magnitudes[peakIndex - 1];
        var magCenter = magnitudes[peakIndex];
        var magRight  = magnitudes[peakIndex + 1];

        double alpha;
        double beta;
        double gamma;

        if (magLeft > 0.0 && magCenter > 0.0 && magRight > 0.0)
        {
            alpha = 20.0 * Math.Log10(magLeft);
            beta  = 20.0 * Math.Log10(magCenter);
            gamma = 20.0 * Math.Log10(magRight);
        }
        else
        {
            alpha = magLeft;
            beta  = magCenter;
            gamma = magRight;
        }

        var denominator = alpha - 2.0 * beta + gamma;
        if (Math.Abs(denominator) < 1e-12)
        {
            return null;
        }

        var fractionalOffset = 0.5 * (alpha - gamma) / denominator;
        var binSpacingHz = frequenciesHz[peakIndex] - frequenciesHz[peakIndex - 1];
        return frequenciesHz[peakIndex] + fractionalOffset * binSpacingHz;
    }

    private static SpectrumData ComputeAveragedSpectrum(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        int fftSize,
        double overlap)
    {
        var regionLength = endSample - startSample;
        var halfFftSize = fftSize / 2 + 1;

        // Hann window coefficients.
        var window = BuildHannWindow(fftSize);

        // Coherent gain correction: sum(window) / N.
        var coherentGain = 0.0;
        for (var i = 0; i < fftSize; i++)
        {
            coherentGain += window[i];
        }
        coherentGain /= fftSize;

        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));

        // Accumulate power per bin across all blocks.
        var powerAccumulator = new double[halfFftSize];
        var blockCount = 0;

        var blockStart = startSample;
        do
        {
            var block = ExtractBlock(samples, blockStart, fftSize, regionLength == 0);

            // Apply window.
            var complexBlock = new Complex[fftSize];
            for (var i = 0; i < fftSize; i++)
            {
                complexBlock[i] = new Complex(block[i] * window[i], 0.0);
            }

            // Forward FFT in-place.
            Fourier.Forward(complexBlock, FourierOptions.NoScaling);

            // Compute one-sided amplitude spectrum with coherent gain correction.
            // DC bin (0) and Nyquist bin (fftSize/2): no doubling.
            // All other bins: double for one-sided.
            for (var k = 0; k < halfFftSize; k++)
            {
                var rawMagnitude = complexBlock[k].Magnitude;
                var amplitude = rawMagnitude / (fftSize * coherentGain);

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

        // If no full block fit, blockCount is already 1 from the initial do-while.
        var actualBlockCount = Math.Max(blockCount, 1);

        var frequenciesHz = new double[halfFftSize];
        var magnitudes = new double[halfFftSize];
        var magnitudesDb = new double?[halfFftSize];

        for (var k = 0; k < halfFftSize; k++)
        {
            var meanPower = powerAccumulator[k] / actualBlockCount;
            var meanMagnitude = Math.Sqrt(meanPower);

            frequenciesHz[k] = Math.Round((double)k * sampleRate / fftSize, 6);
            magnitudes[k] = Math.Round(meanMagnitude, 9);
            magnitudesDb[k] = null; // filled per-channel with dB reference
        }

        return new SpectrumData(frequenciesHz, magnitudes, magnitudesDb);
    }

    private readonly record struct SpectrumData(
        double[] FrequenciesHz,
        double[] Magnitudes,
        double?[] MagnitudesDb);

    // Applies dB reference in-place to avoid allocating new arrays.
    private static void ApplyDbReferenceInPlace(
        double[] magnitudes,
        double?[] magnitudesDb,
        DbReference dbReference)
    {
        if (dbReference.Value <= 0)
        {
            return;
        }

        for (var i = 0; i < magnitudes.Length; i++)
        {
            if (magnitudes[i] > 0)
            {
                magnitudesDb[i] = Math.Round(20.0 * Math.Log10(magnitudes[i] / dbReference.Value), 3);
            }
        }
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

    private static double[] ExtractBlock(float[] samples, int startIndex, int fftSize, bool forceZeroPad)
    {
        var block = new double[fftSize];
        if (forceZeroPad)
        {
            return block; // all zeros
        }

        var available = Math.Min(fftSize, samples.Length - startIndex);
        available = Math.Max(available, 0);

        for (var i = 0; i < available; i++)
        {
            block[i] = samples[startIndex + i];
        }
        // Remaining entries are already zero (zero-padded).
        return block;
    }

    private static int GetBlockCount(
        int sampleRate,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap)
    {
        var startSample = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);
        var regionLength = endSample - startSample;
        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));

        if (regionLength <= 0)
        {
            return 1; // one zero-padded block
        }

        var count = 0;
        var pos = startSample;
        do
        {
            count++;
            pos += hopSize;
        }
        while (pos + fftSize <= endSample);

        return Math.Max(count, 1);
    }
}
