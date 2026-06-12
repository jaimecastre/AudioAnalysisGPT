using AcousticCanvas.Features.Agent.Domain;
using AcousticCanvas.Features.Agent.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Endpoints;

public class ChatCompletionEndpoint(OpenAiChatService chatService)
    : Endpoint<ChatCompletionRequest, ChatCompletionResponse>
{
    public override void Configure()
    {
        Post("/api/agent/chat");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        ChatCompletionRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.Messages.Count == 0)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync(
                "Messages array cannot be empty.",
                cancellationToken
            );
            return;
        }

        try
        {
            Response = await chatService.CompleteAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            HttpContext.Response.StatusCode = 502;
            await HttpContext.Response.WriteAsync(
                $"OpenAI API error: {ex.Message}",
                cancellationToken
            );
        }
    }
}
