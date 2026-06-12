using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record SoundQualitySummaryRequest(string FileId) : ICommand<SoundQualitySummaryResult>;

public record SoundQualitySummaryResult(
    string FileId,
    string FileName,
    string OverallAssessment,
    IReadOnlyList<string> KeyFindings,
    IReadOnlyList<TopMetric> TopMetrics,
    IReadOnlyList<string> Recommendations
);

public record TopMetric(string Name, double Value, string Unit, string Assessment);
