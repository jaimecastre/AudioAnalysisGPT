using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Handlers;

public record BatchBenchmarkSource(
    CompareFileSummary Summary,
    IReadOnlyList<Finding> Findings,
    string? FileId = null
);

public static class BatchBenchmarkBuilder
{
    private const int MinimumOutlierSampleCount = 4;
    private static readonly string[] MetricKeys =
    [
        "rmsDb",
        "peakDb",
        "sharpnessAcum",
        "roughnessAsper",
        "findingCount",
        "strongestTonalPeakProminenceDb",
    ];

    public static BatchBenchmarkResult Build(
        IReadOnlyList<BatchBenchmarkSource> sources,
        DateTimeOffset ranAt)
    {
        var rows = new List<BatchBenchmarkFileRow>();
        foreach (var source in sources)
        {
            rows.Add(BuildRow(source));
        }

        var rankings = BuildRankings(rows);
        var outliers = BuildOutliers(rows);
        var rowsWithFlags = ApplyOutlierFlags(rows, outliers);
        var limitations = BuildLimitations(rowsWithFlags, sources.Count);

        return new BatchBenchmarkResult(
            Files: rowsWithFlags,
            Rankings: rankings,
            Outliers: outliers,
            Limitations: limitations,
            RanAt: ranAt);
    }

    private static BatchBenchmarkFileRow BuildRow(BatchBenchmarkSource source)
    {
        var summary = source.Summary;
        var findings = source.Findings;
        var strongestTonalPeak = FindStrongestTonalPeak(findings);
        var topFindings = BuildTopFindings(findings);

        return new BatchBenchmarkFileRow(
            FileId: source.FileId ?? summary.FileId,
            FileName: summary.FileName,
            RegionStartSeconds: summary.RegionStartSeconds,
            RegionEndSeconds: summary.RegionEndSeconds,
            RmsDb: summary.RmsDb,
            PeakDb: summary.PeakDb,
            CrestFactorDb: summary.CrestFactorDb,
            PeakFrequencyHz: summary.PeakFrequencyHz,
            PeakFrequencyMagnitudeDb: summary.PeakFrequencyMagnitudeDb,
            FindingCount: findings.Count,
            HighSeverityFindingCount: CountBySeverity(findings, "high"),
            MediumSeverityFindingCount: CountBySeverity(findings, "medium"),
            StrongestTonalPeakFrequencyHz: strongestTonalPeak.FrequencyHz,
            StrongestTonalPeakProminenceDb: strongestTonalPeak.ProminenceDb,
            LoudnessSone: summary.SoundQuality?.LoudnessSone,
            SharpnessAcum: summary.SoundQuality?.SharpnessAcum,
            RoughnessAsper: summary.SoundQuality?.RoughnessAsper,
            SoundQualityUnavailableReason: summary.SoundQualityUnavailableReason,
            FlagLabels: BuildInitialFlags(findings, summary.SoundQualityUnavailableReason),
            TopFindings: topFindings);
    }

    private static IReadOnlyList<BatchBenchmarkRanking> BuildRankings(IReadOnlyList<BatchBenchmarkFileRow> rows)
    {
        var rankings = new List<BatchBenchmarkRanking>();

        foreach (var metricKey in MetricKeys)
        {
            var rankedRows = rows
                .Select(row => new { Row = row, Value = GetMetricValue(row, metricKey) })
                .Where(item => item.Value.HasValue)
                .OrderByDescending(item => item.Value!.Value)
                .ThenBy(item => item.Row.FileName, StringComparer.OrdinalIgnoreCase)
                .Select(item => item.Row.FileId)
                .ToArray();

            rankings.Add(new BatchBenchmarkRanking(
                Metric: metricKey,
                Label: GetMetricLabel(metricKey),
                Direction: "descending",
                FileIds: rankedRows));
        }

        return rankings;
    }

    private static IReadOnlyList<BatchBenchmarkOutlier> BuildOutliers(IReadOnlyList<BatchBenchmarkFileRow> rows)
    {
        if (rows.Count < MinimumOutlierSampleCount)
        {
            return [];
        }

        var outliers = new List<BatchBenchmarkOutlier>();

        foreach (var metricKey in MetricKeys)
        {
            var values = rows
                .Select(row => new { Row = row, Value = GetMetricValue(row, metricKey) })
                .Where(item => item.Value.HasValue)
                .OrderBy(item => item.Value!.Value)
                .ToArray();

            if (values.Length < MinimumOutlierSampleCount)
            {
                continue;
            }

            var sortedValues = values.Select(item => item.Value!.Value).ToArray();
            var q1 = Percentile(sortedValues, 0.25);
            var q3 = Percentile(sortedValues, 0.75);
            var iqr = q3 - q1;

            if (iqr <= 0.0)
            {
                continue;
            }

            var lowerFence = q1 - (1.5 * iqr);
            var upperFence = q3 + (1.5 * iqr);

            foreach (var item in values)
            {
                var value = item.Value!.Value;
                if (value < lowerFence)
                {
                    outliers.Add(BuildOutlier(item.Row.FileId, metricKey, "low", value, lowerFence, upperFence));
                }
                else if (value > upperFence)
                {
                    outliers.Add(BuildOutlier(item.Row.FileId, metricKey, "high", value, lowerFence, upperFence));
                }
            }
        }

        return outliers;
    }

    private static BatchBenchmarkOutlier BuildOutlier(
        string fileId,
        string metricKey,
        string direction,
        double value,
        double lowerFence,
        double upperFence)
    {
        return new BatchBenchmarkOutlier(
            FileId: fileId,
            Metric: metricKey,
            Label: GetMetricLabel(metricKey),
            Direction: direction,
            Value: Math.Round(value, 4),
            LowerFence: Math.Round(lowerFence, 4),
            UpperFence: Math.Round(upperFence, 4));
    }

    private static IReadOnlyList<BatchBenchmarkFileRow> ApplyOutlierFlags(
        IReadOnlyList<BatchBenchmarkFileRow> rows,
        IReadOnlyList<BatchBenchmarkOutlier> outliers)
    {
        var updatedRows = new List<BatchBenchmarkFileRow>();

        foreach (var row in rows)
        {
            var labels = row.FlagLabels.ToList();
            var rowOutliers = outliers.Where(outlier => outlier.FileId == row.FileId).ToArray();

            foreach (var outlier in rowOutliers)
            {
                labels.Add(outlier.Direction == "high"
                    ? $"High {outlier.Label.ToLowerInvariant()}"
                    : $"Low {outlier.Label.ToLowerInvariant()}");
            }

            updatedRows.Add(row with { FlagLabels = labels.Distinct(StringComparer.OrdinalIgnoreCase).ToArray() });
        }

        return updatedRows;
    }

    private static IReadOnlyList<string> BuildLimitations(
        IReadOnlyList<BatchBenchmarkFileRow> rows,
        int fileCount)
    {
        var limitations = new List<string>
        {
            "Digital amplitude values are uncalibrated dBFS measurements until physical SPL calibration is configured.",
        };

        if (fileCount < MinimumOutlierSampleCount)
        {
            limitations.Add("Statistical outlier flags require at least 4 files; rankings are still shown.");
        }

        foreach (var row in rows)
        {
            if (!string.IsNullOrWhiteSpace(row.SoundQualityUnavailableReason))
            {
                limitations.Add($"{row.FileName}: {row.SoundQualityUnavailableReason}");
            }
        }

        return limitations.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static IReadOnlyList<string> BuildInitialFlags(
        IReadOnlyList<Finding> findings,
        string? soundQualityUnavailableReason)
    {
        var labels = new List<string>();

        if (CountBySeverity(findings, "high") > 0)
        {
            labels.Add("High severity findings");
        }

        if (CountBySeverity(findings, "medium") > 0)
        {
            labels.Add("Medium severity findings");
        }

        if (!string.IsNullOrWhiteSpace(soundQualityUnavailableReason))
        {
            labels.Add("Sound quality unavailable");
        }

        return labels;
    }

    private static IReadOnlyList<BatchBenchmarkFindingSummary> BuildTopFindings(IReadOnlyList<Finding> findings)
    {
        return findings
            .OrderBy(finding => SeverityRank(finding.Severity))
            .ThenBy(finding => finding.StartSeconds ?? double.MaxValue)
            .Take(3)
            .Select(finding => new BatchBenchmarkFindingSummary(
                FindingId: finding.FindingId,
                Type: finding.Type,
                Severity: finding.Severity,
                Title: finding.Title,
                StartSeconds: finding.StartSeconds,
                EndSeconds: finding.EndSeconds,
                FrequencyHz: finding.FrequencyHz))
            .ToArray();
    }

    private static (double? FrequencyHz, double? ProminenceDb) FindStrongestTonalPeak(IReadOnlyList<Finding> findings)
    {
        Finding? strongestFinding = null;
        var strongestProminence = double.NegativeInfinity;

        foreach (var finding in findings)
        {
            if (finding.Type != "tonal_peak")
            {
                continue;
            }

            if (!finding.Evidence.TryGetValue("prominenceDb", out var rawProminence))
            {
                continue;
            }

            var prominence = ConvertToNullableDouble(rawProminence);
            if (!prominence.HasValue || prominence.Value <= strongestProminence)
            {
                continue;
            }

            strongestFinding = finding;
            strongestProminence = prominence.Value;
        }

        if (strongestFinding is null)
        {
            return (null, null);
        }

        return (strongestFinding.FrequencyHz, Math.Round(strongestProminence, 2));
    }

    private static int CountBySeverity(IReadOnlyList<Finding> findings, string severity)
    {
        var count = 0;
        foreach (var finding in findings)
        {
            if (string.Equals(finding.Severity, severity, StringComparison.OrdinalIgnoreCase))
            {
                count++;
            }
        }

        return count;
    }

    private static int SeverityRank(string severity)
    {
        return severity.ToLowerInvariant() switch
        {
            "high" => 0,
            "medium" => 1,
            "low" => 2,
            _ => 3,
        };
    }

    private static double Percentile(IReadOnlyList<double> sortedValues, double percentile)
    {
        if (sortedValues.Count == 0)
        {
            return 0.0;
        }

        var position = (sortedValues.Count - 1) * percentile;
        var lowerIndex = (int)Math.Floor(position);
        var upperIndex = (int)Math.Ceiling(position);

        if (lowerIndex == upperIndex)
        {
            return sortedValues[lowerIndex];
        }

        var weight = position - lowerIndex;
        return sortedValues[lowerIndex] + ((sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight);
    }

    private static double? ConvertToNullableDouble(object? value)
    {
        return value switch
        {
            double doubleValue => doubleValue,
            float floatValue => floatValue,
            int intValue => intValue,
            long longValue => longValue,
            decimal decimalValue => (double)decimalValue,
            _ => null,
        };
    }

    private static double? GetMetricValue(BatchBenchmarkFileRow row, string metricKey)
    {
        return metricKey switch
        {
            "rmsDb" => row.RmsDb,
            "peakDb" => row.PeakDb,
            "sharpnessAcum" => row.SharpnessAcum,
            "roughnessAsper" => row.RoughnessAsper,
            "findingCount" => row.FindingCount,
            "strongestTonalPeakProminenceDb" => row.StrongestTonalPeakProminenceDb,
            _ => null,
        };
    }

    private static string GetMetricLabel(string metricKey)
    {
        return metricKey switch
        {
            "rmsDb" => "RMS level",
            "peakDb" => "Peak level",
            "sharpnessAcum" => "Sharpness",
            "roughnessAsper" => "Roughness",
            "findingCount" => "Findings",
            "strongestTonalPeakProminenceDb" => "Strongest tonal peak",
            _ => metricKey,
        };
    }
}
