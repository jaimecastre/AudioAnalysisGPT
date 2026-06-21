using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Commands;

public sealed record AgentConversationTurn(string Role, string Content);

public record AgentAskCommand(
    string Question,
    IReadOnlyList<string> SelectedFileIds,
    IReadOnlyList<AgentConversationTurn> ConversationContext,
    string? ProjectId,
    string? Mode,
    string? ModelOverride,
    double? ActiveSelectionStartSeconds = null,
    double? ActiveSelectionEndSeconds = null
) : ICommand<AgentAskResult>;
