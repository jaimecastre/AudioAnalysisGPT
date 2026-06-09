namespace AcousticCanvas.Features.Agent.Commands;

public record AgentAskResult(
    string ConversationId,
    string Answer,
    string EvidencePackageId,
    IReadOnlyList<string> EvidenceReferences,
    string Confidence,
    IReadOnlyList<string> Limitations,
    IReadOnlyList<string> SuggestedNextSteps,
    IReadOnlyList<AgentToolExecutionRecord> ToolExecutions,
    bool ValidationWarning,
    IReadOnlyDictionary<string, object>? ToolResultsData
);

public record AgentToolExecutionRecord(
    string ToolName,
    string Status,
    string? ResultRef,
    string? ErrorCode,
    string? ErrorMessage
);
