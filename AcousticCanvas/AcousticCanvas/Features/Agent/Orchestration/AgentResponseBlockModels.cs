namespace AcousticCanvas.Features.Agent.Orchestration;

public abstract record AgentResponseBlock
{
    public abstract string BlockType { get; }
}

public sealed record MarkdownBlock : AgentResponseBlock
{
    public override string BlockType => "markdown";
    public required string Content { get; init; }
}

public sealed record StatisticRow
{
    public required string Label { get; init; }
    public required string Value { get; init; }
    public string? Unit { get; init; }
}

public sealed record StatisticsBlock : AgentResponseBlock
{
    public override string BlockType => "statistics";
    public required string Title { get; init; }
    public required IReadOnlyList<StatisticRow> Rows { get; init; }
}

public sealed record ChartMetadata
{
    public string? SourceTool { get; init; }
    public string? FileId { get; init; }
    public string? FileName { get; init; }
    public int? FftSize { get; init; }
    public string? WindowType { get; init; }
    public double? OverlapPercent { get; init; }
    public string? Scaling { get; init; }
    public string? CalibrationNote { get; init; }
    public DateTime? ComputedAtUtc { get; init; }
}

public sealed record SpectrumChartBlock : AgentResponseBlock
{
    public override string BlockType => "spectrumChart";
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public required IReadOnlyList<double> FrequenciesHz { get; init; }
    public required IReadOnlyList<double> MagnitudesDb { get; init; }
    public double? PeakFrequencyHz { get; init; }
    public required ChartMetadata Metadata { get; init; }
}

public sealed record RankedItem
{
    public required int Rank { get; init; }
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public required double Score { get; init; }
    public required string ScoreLabel { get; init; }
    public string? ScoreUnit { get; init; }
}

public sealed record RankingBlock : AgentResponseBlock
{
    public override string BlockType => "ranking";
    public required string Title { get; init; }
    public required string MetricName { get; init; }
    public required IReadOnlyList<RankedItem> RankedItems { get; init; }
}

public sealed record SuggestedAction
{
    public required string Label { get; init; }
    public required string ActionType { get; init; }
    public string? ToolName { get; init; }
    public string? PromptText { get; init; }
}

public sealed record SuggestedActionsBlock : AgentResponseBlock
{
    public override string BlockType => "suggestedActions";
    public required IReadOnlyList<SuggestedAction> Actions { get; init; }
}

// ─── Phase 2: Analysis View Block ─────────────────────────────────────────

public sealed record AnalysisViewBlock : AgentResponseBlock
{
    public override string BlockType => "analysisView";

    /// <summary>
    /// Type of analysis view: spectrum, spectrogram, cpb, soundQuality, findings
    /// </summary>
    public required string ViewType { get; init; }

    /// <summary>
    /// Reference to the stored analysis result (e.g., spectrum_abc123)
    /// </summary>
    public required string ResultId { get; init; }

    /// <summary>
    /// File ID the analysis was run on
    /// </summary>
    public required string FileId { get; init; }

    /// <summary>
    /// Human-readable file name
    /// </summary>
    public required string FileName { get; init; }

    /// <summary>
    /// Compact summary for inline display in chat
    /// </summary>
    public required CompactSummary Summary { get; init; }

    /// <summary>
    /// Optional: Title override for the view
    /// </summary>
    public string? Title { get; init; }

    /// <summary>
    /// Optional: Preview data for inline mini-chart (e.g., spectrum preview)
    /// </summary>
    public AnalysisPreview? Preview { get; init; }
}

/// <summary>
/// Preview data for inline mini-chart in AnalysisViewBlock
/// </summary>
public sealed record AnalysisPreview
{
    public double[]? FrequenciesHz { get; init; }
    public double[]? MagnitudesDb { get; init; }
}

/// <summary>
/// Compact summary for mini inline display before user expands to full view
/// </summary>
public sealed record CompactSummary
{
    /// <summary>
    /// Primary metric or finding (e.g., "Peak: -3.2 dBFS @ 255 Hz")
    /// </summary>
    public string? PrimaryMetric { get; init; }

    /// <summary>
    /// Secondary metrics for display (up to 3 key values)
    /// </summary>
    public IReadOnlyList<MetricItem>? SecondaryMetrics { get; init; }

    /// <summary>
    /// Brief status or assessment (e.g., "No clipping detected", "3 findings")
    /// </summary>
    public string? StatusText { get; init; }

    /// <summary>
    /// Status indicator: success, warning, error, info
    /// </summary>
    public string? StatusIndicator { get; init; }
}

public sealed record MetricItem
{
    public required string Label { get; init; }
    public required string Value { get; init; }
    public string? Unit { get; init; }
}
