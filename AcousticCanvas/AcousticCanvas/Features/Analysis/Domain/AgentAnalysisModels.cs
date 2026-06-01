namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class AgentAnalysisResult
{
    public required string Kind { get; init; }
    public required string FileId { get; init; }
    public double? RegionStart { get; init; }
    public double? RegionEnd { get; init; }
    public required Dictionary<string, object?> Summary { get; init; }
    public required DateTimeOffset RanAt { get; init; }
}
