using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Orchestration;
using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Handlers;

public sealed class AgentAskHandler(AgentOrchestrator agentOrchestrator)
    : CommandHandler<AgentAskCommand, AgentAskResult>
{
    public override async Task<AgentAskResult> ExecuteAsync(
        AgentAskCommand command,
        CancellationToken ct
    )
    {
        return await agentOrchestrator.HandleUserQuestionAsync(command, ct);
    }
}
