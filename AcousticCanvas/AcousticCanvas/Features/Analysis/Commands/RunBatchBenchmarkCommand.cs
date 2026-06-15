using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunBatchBenchmarkCommand(
    IReadOnlyList<string> FileIds,
    IReadOnlyList<string> FilePaths,
    double? StartSeconds,
    double? EndSeconds
) : ICommand<BatchBenchmarkResult>;

public record BatchBenchmarkFileRow(
    string FileId,
    string FileName,
    double RegionStartSeconds,
    double RegionEndSeconds,
    double RmsDb,
    double PeakDb,
    double CrestFactorDb,
    double PeakFrequencyHz,
    double PeakFrequencyMagnitudeDb,
    int FindingCount,
    int HighSeverityFindingCount,
    int MediumSeverityFindingCount,
    double? StrongestTonalPeakFrequencyHz,
    double? StrongestTonalPeakProminenceDb,
    double? LoudnessSone,
    double? SharpnessAcum,
    double? RoughnessAsper,
    string? SoundQualityUnavailableReason,
    IReadOnlyList<string> FlagLabels,
    IReadOnlyList<BatchBenchmarkFindingSummary> TopFindings,
    string? DbUnit = null
);

public record BatchBenchmarkFindingSummary(
    string FindingId,
    string Type,
    string Severity,
    string Title,
    double? StartSeconds,
    double? EndSeconds,
    double? FrequencyHz
);

public record BatchBenchmarkRanking(
    string Metric,
    string Label,
    string Direction,
    IReadOnlyList<string> FileIds
);

public record BatchBenchmarkOutlier(
    string FileId,
    string Metric,
    string Label,
    string Direction,
    double Value,
    double LowerFence,
    double UpperFence
);

public record BatchBenchmarkResult(
    IReadOnlyList<BatchBenchmarkFileRow> Files,
    IReadOnlyList<BatchBenchmarkRanking> Rankings,
    IReadOnlyList<BatchBenchmarkOutlier> Outliers,
    IReadOnlyList<string> Limitations,
    DateTimeOffset RanAt
);
