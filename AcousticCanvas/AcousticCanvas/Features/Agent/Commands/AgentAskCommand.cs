using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Commands;

public record AgentAskCommand(
    string Question,
    IReadOnlyList<string> SelectedFileIds,
    string? ProjectId,
    string? Mode,
    string? ModelOverride
) : ICommand<AgentAskResult>;
