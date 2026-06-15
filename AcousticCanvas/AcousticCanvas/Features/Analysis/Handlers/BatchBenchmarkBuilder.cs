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
    public static BatchBenchmarkResult Build(
        IReadOnlyList<BatchBenchmarkSource> sources,
        DateTimeOffset ranAt
    )
    {
        var rows = new List<BatchBenchmarkFileRow>();
        foreach (var source in sources)
        {
            rows.Add(BuildRow(source));
        }

        var rankings = BatchBenchmarkStatistics.BuildRankings(rows);
        var outliers = BatchBenchmarkStatistics.BuildOutliers(rows);
        var rowsWithFlags = BatchBenchmarkStatistics.ApplyOutlierFlags(rows, outliers);
        var limitations = BatchBenchmarkStatistics.BuildLimitations(rowsWithFlags, sources.Count);

        return new BatchBenchmarkResult(
            Files: rowsWithFlags,
            Rankings: rankings,
            Outliers: outliers,
            Limitations: limitations,
            RanAt: ranAt
        );
    }

    private static BatchBenchmarkFileRow BuildRow(BatchBenchmarkSource source)
    {
        var summary = source.Summary;
        var findings = source.Findings;
        var strongestTonalPeak = BatchBenchmarkStatistics.FindStrongestTonalPeak(findings);
        var topFindings = BatchBenchmarkStatistics.BuildTopFindings(findings);

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
            HighSeverityFindingCount: BatchBenchmarkStatistics.CountBySeverity(findings, "high"),
            MediumSeverityFindingCount: BatchBenchmarkStatistics.CountBySeverity(
                findings,
                "medium"
            ),
            StrongestTonalPeakFrequencyHz: strongestTonalPeak.FrequencyHz,
            StrongestTonalPeakProminenceDb: strongestTonalPeak.ProminenceDb,
            LoudnessSone: summary.SoundQuality?.LoudnessSone,
            SharpnessAcum: summary.SoundQuality?.SharpnessAcum,
            RoughnessAsper: summary.SoundQuality?.RoughnessAsper,
            SoundQualityUnavailableReason: summary.SoundQualityUnavailableReason,
            FlagLabels: BatchBenchmarkStatistics.BuildInitialFlags(
                findings,
                summary.SoundQualityUnavailableReason
            ),
            TopFindings: topFindings,
            DbUnit: summary.DbUnit
        );
    }
}
