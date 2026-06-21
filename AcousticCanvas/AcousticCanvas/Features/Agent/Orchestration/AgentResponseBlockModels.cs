namespace AcousticCanvas.Features.Agent.Orchestration;

public abstract record AgentResponseBlock
{
    public abstract string BlockType { get; }
}

public sealed record MarkdownBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.Markdown;
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
    public override string BlockType => VisualizationBlockTypes.Statistics;
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
    public override string BlockType => VisualizationBlockTypes.SpectrumChart;
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
    public override string BlockType => VisualizationBlockTypes.Ranking;
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
    public override string BlockType => VisualizationBlockTypes.SuggestedActions;
    public required IReadOnlyList<SuggestedAction> Actions { get; init; }
}

// ─── Phase 7: Generated Analysis Workflow ────────────────────────────────

/// <summary>
/// One deterministic step in an agent-generated analysis workflow.
/// </summary>
public sealed record WorkflowStep
{
    public required int StepNumber { get; init; }
    public required string ToolName { get; init; }
    public required string EvidenceType { get; init; }
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public string? ResultId { get; init; }
    public required string Description { get; init; }
}

/// <summary>
/// Shows how the agent decomposed a broader investigation into deterministic analysis steps.
/// Built by the backend from tool/evidence metadata — never by arbitrary LLM UI code.
/// </summary>
public sealed record WorkflowBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.Workflow;
    public required string Title { get; init; }
    public required string Question { get; init; }
    public required IReadOnlyList<WorkflowStep> Steps { get; init; }
}

// ─── Phase 2: Analysis View Block ─────────────────────────────────────────

public sealed record AnalysisViewBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.AnalysisView;

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

    /// <summary>
    /// Optional: Agent-specified hints to focus the viewer on the most relevant region
    /// </summary>
    public PlotHints? PlotHints { get; init; }
}

// ─── Phase 4: Plot Hints ──────────────────────────────────────────────────

/// <summary>
/// Deterministic viewer hints populated from DSP evidence — never from the LLM.
/// Used to focus spectrum/CPB viewers on the most relevant frequency region.
/// </summary>
public sealed record PlotHints
{
    /// <summary>
    /// Frequency (Hz) to highlight as the primary point of interest (e.g., dominant peak)
    /// </summary>
    public double? FocusFrequencyHz { get; init; }

    /// <summary>
    /// Lower bound (Hz) of the frequency window to display
    /// </summary>
    public double? FrequencyRangeMinHz { get; init; }

    /// <summary>
    /// Upper bound (Hz) of the frequency window to display
    /// </summary>
    public double? FrequencyRangeMaxHz { get; init; }

    /// <summary>
    /// Human-readable annotation label for the focus frequency (e.g., "peak at 1.2 kHz")
    /// </summary>
    public string? AnnotationLabel { get; init; }

    /// <summary>
    /// Scale override for frequency axis: "log" or "linear". Null means use viewer default.
    /// </summary>
    public string? ScaleOverride { get; init; }
}

// ─── Phase 5: Spectrum Overlay Block ──────────────────────────────────────

/// <summary>
/// One signal entry in a spectrum overlay — carries the result reference and per-signal focus hints.
/// </summary>
public sealed record OverlaySignal
{
    public required string ResultId { get; init; }
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public PlotHints? PlotHints { get; init; }
}

/// <summary>
/// Deterministic multi-file spectrum overlay block — built by ExpertVisualizationPlanner,
/// never by the LLM. Renders all signals in a single SpectrumCanvas for direct comparison.
/// </summary>
public sealed record SpectrumOverlayBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.SpectrumOverlay;

    /// <summary>Title shown above the overlay chart</summary>
    public required string Title { get; init; }

    /// <summary>Ordered list of signals to overlay</summary>
    public required IReadOnlyList<OverlaySignal> Signals { get; init; }

    /// <summary>Shared frequency window hint (union of individual signal hints)</summary>
    public PlotHints? SharedPlotHints { get; init; }
}

// ─── Phase 6: Investigation Block ─────────────────────────────────────────

/// <summary>
/// One DSP result contributing to a multi-tool investigation.
/// </summary>
public sealed record InvestigationSignal
{
    public required string ResultId { get; init; }
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public required string ViewType { get; init; }
    public PlotHints? PlotHints { get; init; }
}

/// <summary>
/// Groups multiple DSP results from different tool types into one diagnostic card.
/// Built by ExpertVisualizationPlanner — never by the LLM.
/// </summary>
public sealed record InvestigationBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.Investigation;

    /// <summary>Short diagnostic question this investigation answers</summary>
    public required string DiagnosticQuestion { get; init; }

    /// <summary>Ordered DSP results that together answer the question</summary>
    public required IReadOnlyList<InvestigationSignal> Signals { get; init; }
}

// ─── Phase 5 (remaining): Sound Quality Comparison Block ──────────────────

/// <summary>
/// One file entry in a sound-quality side-by-side comparison.
/// Metric values are embedded directly — no result store fetch needed.
/// </summary>
public sealed record SoundQualitySignal
{
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public required double LoudnessSone { get; init; }
    public required double SharpnessAcum { get; init; }
    public required double RoughnessAsper { get; init; }
}

/// <summary>
/// Deterministic multi-file sound-quality comparison block — built by ExpertVisualizationPlanner,
/// never by the LLM. Renders loudness / sharpness / roughness bars per file side-by-side.
/// </summary>
public sealed record SoundQualityComparisonBlock : AgentResponseBlock
{
    public override string BlockType => VisualizationBlockTypes.SoundQualityComparison;

    /// <summary>Title shown above the comparison card</summary>
    public required string Title { get; init; }

    /// <summary>Ordered list of files to compare</summary>
    public required IReadOnlyList<SoundQualitySignal> Signals { get; init; }
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
