using AcousticCanvas.Features.Agent.Commands;
using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Endpoints;

public sealed class AgentAskRequest
{
    public string Question { get; set; } = string.Empty;
    public List<string> SelectedFileIds { get; set; } = [];
    public List<AgentConversationTurn> ConversationContext { get; set; } = [];
    public string? ProjectId { get; set; }
    public string? Mode { get; set; }
    public string? ModelOverride { get; set; }
    public double? ActiveSelectionStartSeconds { get; set; }
    public double? ActiveSelectionEndSeconds { get; set; }
}

public sealed class AgentAskEndpoint : Endpoint<AgentAskRequest, AgentAskResult>
{
    public override void Configure()
    {
        Post("/api/agent/ask");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        AgentAskRequest request,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync("Question cannot be empty.", cancellationToken);
            return;
        }

        if (request.SelectedFileIds.Count == 0)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync(
                "At least one file must be selected.",
                cancellationToken
            );
            return;
        }

        var command = new AgentAskCommand(
            Question: request.Question,
            SelectedFileIds: request.SelectedFileIds,
            ConversationContext: request.ConversationContext,
            ProjectId: request.ProjectId,
            Mode: request.Mode,
            ModelOverride: request.ModelOverride,
            ActiveSelectionStartSeconds: request.ActiveSelectionStartSeconds,
            ActiveSelectionEndSeconds: request.ActiveSelectionEndSeconds
        );

        try
        {
            var result = await command.ExecuteAsync(cancellationToken);
            Response = result;
        }
        catch (OperationCanceledException)
        {
            HttpContext.Response.StatusCode = 499;
            await HttpContext.Response.WriteAsync("Request was cancelled.", cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                $"Agent orchestration error: {ex.Message}",
                cancellationToken
            );
        }
    }
}
