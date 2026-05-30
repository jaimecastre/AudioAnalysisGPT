using FastEndpoints;
using AcousticCanvas.Features.Playback.Commands;
using AcousticCanvas.Features.Playback.Handlers;

namespace AcousticCanvas.Features.Playback.Endpoints;

public class PlaybackControlEndpoint(PlaybackControlHandler handler)
    : Endpoint<ControlPlaybackRequest, PlaybackStateResult>
{
    public override void Configure()
    {
        Post("/api/audio/playback/control");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ControlPlaybackRequest request, CancellationToken cancellationToken)
    {
        var command = new ControlPlaybackCommand(
            request.FileId,
            request.Action.ToLowerInvariant(),
            request.TimeSeconds
        );

        var result = await handler.ExecuteAsync(command, cancellationToken);

        Response = result;
    }
}

public class ControlPlaybackRequest
{
    public string FileId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public double TimeSeconds { get; set; }
}
