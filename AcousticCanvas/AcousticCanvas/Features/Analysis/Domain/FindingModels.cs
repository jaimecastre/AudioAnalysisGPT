namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class Finding
{
    public required string FindingId { get; init; }
    public required string FileId { get; init; }

    // Short machine-readable type: "clipping", "silence_gap", "high_crest_factor", "dc_offset"
    public required string Type { get; init; }

    // "low" | "medium" | "high"
    public required string Severity { get; init; }

    // "observed" = directly measured; "inferred" = derived from a metric threshold
    public required string Confidence { get; init; }

    public required string Title { get; init; }
    public required string Description { get; init; }

    // Key/value pairs of the measured evidence supporting this finding
    public required Dictionary<string, object?> Evidence { get; init; }

    // Time location — null when the finding applies to the whole file
    public double? StartSeconds { get; init; }
    public double? EndSeconds { get; init; }

    // Frequency location — null when not frequency-specific
    public double? FrequencyHz { get; init; }

    public required string SuggestedNextStep { get; init; }

    public required DateTimeOffset GeneratedAt { get; init; }
}

public sealed class FindingsResult
{
    public required string FileId { get; init; }
    public required IReadOnlyList<Finding> Findings { get; init; }
    public required int FindingCount { get; init; }
    public required DateTimeOffset RanAt { get; init; }
}
