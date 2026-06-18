using System.Text.Json.Serialization;

namespace AcousticCanvas.Features.Agent.Commands;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum InvestigationPath
{
    LlmPlanned,
    DeterministicFact,
    DeterministicVisual,
    MetaQuestion,
    NoFiles,
}

public record PlannedToolTrace(string Name, IReadOnlyDictionary<string, object?> Arguments);

public record ToolExecutionTrace(
    string Name,
    string Status,
    DateTime? StartedAtUtc,
    DateTime? FinishedAtUtc,
    string? ErrorMessage
);

public record VisualizationPlanBlockTrace(
    string BlockType,
    string Reason,
    string? ViewType,
    string? SourceEvidenceId
);

public record VisualizationPlanTrace(
    string PrimaryEvidenceType,
    IReadOnlyList<VisualizationPlanBlockTrace> Blocks
);

public record InvestigationTrace(
    string Question,
    string ConversationId,
    InvestigationPath Path,
    IReadOnlyList<PlannedToolTrace> PlannedTools,
    IReadOnlyList<ToolExecutionTrace> ToolExecutions,
    string FinalAnswer,
    string Confidence,
    DateTime TimestampUtc,
    VisualizationPlanTrace? VisualizationPlan = null
);
