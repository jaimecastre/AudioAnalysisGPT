using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class TonalPeakDetector
{
    private const double MinimumTonalPeakFrequencyHz = 20.0;
    private const double MinimumReportedProminenceDb = 6.0;
    private const double HighConfidenceProminenceDb = 12.0;
    private const int MaxTonalPeaks = 5;
    private const string TonalPeakMethod = "quadratic_interpolation";

    public static IReadOnlyList<TonalPeak> Detect(
        IReadOnlyList<double> frequenciesHz,
        IReadOnlyList<double> magnitudes,
        IReadOnlyList<double?> magnitudesDb
    )
    {
        if (
            frequenciesHz.Count < 5
            || magnitudes.Count != frequenciesHz.Count
            || magnitudesDb.Count != frequenciesHz.Count
        )
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

            if (
                !IsFinite(dbValues[i])
                || dbValues[i] <= dbValues[i - 1]
                || dbValues[i] < dbValues[i + 1]
            )
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

            var bandwidthHz = EstimatePeakBandwidthHz(
                dbValues,
                frequenciesHz,
                i,
                dbValues[i] - 3.0
            );

            var confidence =
                prominenceDb >= HighConfidenceProminenceDb
                && IsNarrowPeak(frequenciesHz[i], bandwidthHz)
                    ? "high"
                    : "medium";

            var interpolatedPeakHz =
                QuadraticInterpolateFrequencyHz(magnitudes, frequenciesHz, i) ?? frequenciesHz[i];

            candidates.Add(
                new TonalPeak
                {
                    FrequencyHz = Math.Round(interpolatedPeakHz, 3),
                    MagnitudeDb = Math.Round(dbValues[i], 3),
                    LocalFloorDb = Math.Round(localFloor.Value, 3),
                    ProminenceDb = Math.Round(prominenceDb, 3),
                    BandwidthHz = Math.Round(bandwidthHz, 3),
                    Confidence = confidence,
                    Method = TonalPeakMethod,
                }
            );
        }

        return candidates
            .OrderByDescending(peak => peak.ProminenceDb)
            .ThenByDescending(peak => peak.MagnitudeDb)
            .Take(MaxTonalPeaks)
            .ToArray();
    }

    private static double[] BuildDbValues(
        IReadOnlyList<double> magnitudes,
        IReadOnlyList<double?> magnitudesDb
    )
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

    private static double? EstimateLocalFloorDb(
        double[] dbValues,
        int peakIndex,
        double binSpacingHz
    )
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
        double thresholdDb
    )
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
    /// Falls back to linear magnitude if any neighbour is zero or negative.
    /// </summary>
    public static double? QuadraticInterpolateFrequencyHz(
        IReadOnlyList<double> magnitudes,
        IReadOnlyList<double> frequenciesHz,
        int peakIndex
    )
    {
        if (peakIndex <= 0 || peakIndex >= magnitudes.Count - 1)
        {
            return null;
        }

        var magLeft = magnitudes[peakIndex - 1];
        var magCenter = magnitudes[peakIndex];
        var magRight = magnitudes[peakIndex + 1];

        double alpha;
        double beta;
        double gamma;

        if (magLeft > 0.0 && magCenter > 0.0 && magRight > 0.0)
        {
            alpha = 20.0 * Math.Log10(magLeft);
            beta = 20.0 * Math.Log10(magCenter);
            gamma = 20.0 * Math.Log10(magRight);
        }
        else
        {
            alpha = magLeft;
            beta = magCenter;
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
}
