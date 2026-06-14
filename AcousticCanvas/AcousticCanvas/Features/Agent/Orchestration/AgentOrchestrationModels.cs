using System.Text.Json;
using System.Text.Json.Serialization;

namespace AcousticCanvas.Features.Agent.Orchestration;

// ─── Planner output models ─────────────────────────────────────────────────

public sealed class PlannerResponse
{
    [JsonPropertyName("action")]
    public required string Action { get; init; }

    [JsonPropertyName("tools")]
    public List<PlannerToolRequest>? Tools { get; init; }

    [JsonPropertyName("question")]
    public string? ClarificationQuestion { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    [JsonPropertyName("requiredEvidenceIds")]
    public List<string>? RequiredEvidenceIds { get; init; }
}

public sealed class PlannerToolRequest
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("arguments")]
    public required Dictionary<string, object?> Arguments { get; init; }
}

// ─── Tool execution output ─────────────────────────────────────────────────

public sealed class ToolExecutionOutput
{
    public required string ToolName { get; init; }
    public required string Status { get; init; }
    public required string ResultRef { get; init; }
    public object? ResultData { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTime? StartedAtUtc { get; init; }
    public DateTime? FinishedAtUtc { get; init; }
}

// ─── Evidence package ──────────────────────────────────────────────────────

public sealed class EvidencePackage
{
    public required string EvidencePackageId { get; init; }
    public required string UserQuestion { get; init; }
    public required IReadOnlyList<string> SelectedFileIds { get; init; }
    public required IReadOnlyList<string> AnalysesRun { get; init; }
    public required IReadOnlyList<EvidenceItem> KeyEvidence { get; init; }
    public required IReadOnlyList<string> Limitations { get; init; }
}

public sealed class EvidenceItem
{
    public required string EvidenceId { get; init; }
    public required string Type { get; init; }
    public required Dictionary<string, object?> Data { get; init; }
}

// ─── Final answer from OpenAI ─────────────────────────────────────────────

public sealed class FinalAnswerResponse
{
    [JsonPropertyName("answer")]
    public required string Answer { get; init; }

    [JsonPropertyName("evidenceReferences")]
    public List<string> EvidenceReferences { get; init; } = [];

    [JsonPropertyName("confidence")]
    public required string Confidence { get; init; }

    [JsonPropertyName("limitations")]
    public List<string> Limitations { get; init; } = [];

    [JsonPropertyName("suggestedNextSteps")]
    public List<string> SuggestedNextSteps { get; init; } = [];

    [JsonPropertyName("blocks")]
    public List<JsonElement>? Blocks { get; init; }
}

// ─── Validation result ─────────────────────────────────────────────────────

public sealed class ValidationResult
{
    public required bool IsAcceptable { get; init; }
    public required bool HasWarning { get; init; }
    public string? WarningReason { get; init; }
}
