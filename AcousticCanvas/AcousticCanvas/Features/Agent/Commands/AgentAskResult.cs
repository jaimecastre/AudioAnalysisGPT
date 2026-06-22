using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Features.Agent.Commands;

public static class BackendRuntimeIdentity
{
    public static string Id { get; } = "runtime_" + Guid.NewGuid().ToString("N")[..12];
}

public record AgentAskResult(
    string ConversationId,
    string Answer,
    string EvidencePackageId,
    IReadOnlyList<string> EvidenceReferences,
    IReadOnlyList<AgentEvidenceItem> EvidenceItems,
    string Confidence,
    IReadOnlyList<string> Limitations,
    IReadOnlyList<string> SuggestedNextSteps,
    IReadOnlyList<AgentToolExecutionRecord> ToolExecutions,
    bool ValidationWarning,
    IReadOnlyDictionary<string, object>? ToolResultsData,
    IReadOnlyList<string> PlannedTools,
    string? PlannerReason,
    InvestigationTrace? InvestigationTrace,
    List<JsonElement>? Blocks,
    IReadOnlyDictionary<string, PlotHints>? PlotHintsMap = null,
    IReadOnlyList<SpectrumOverlayBlock>? OverlayBlocks = null,
    IReadOnlyList<InvestigationBlock>? InvestigationBlocks = null,
    IReadOnlyList<SoundQualityComparisonBlock>? SoundQualityComparisonBlocks = null,
    IReadOnlyList<RadarChartBlock>? RadarChartBlocks = null
)
{
    public string BackendRuntimeId { get; init; } = BackendRuntimeIdentity.Id;
}

public record AgentEvidenceItem(
    string EvidenceId,
    string Type,
    IReadOnlyDictionary<string, object?> Data
);

public record AgentToolExecutionRecord(
    string ToolName,
    string Status,
    string? ResultRef,
    string? ErrorCode,
    string? ErrorMessage
);
