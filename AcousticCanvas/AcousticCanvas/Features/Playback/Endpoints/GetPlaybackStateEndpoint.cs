using AcousticCanvas.Features.Playback.Commands;
using AcousticCanvas.Features.Playback.Handlers;
using FastEndpoints;

namespace AcousticCanvas.Features.Playback.Endpoints;

public class GetPlaybackStateEndpoint(GetPlaybackStateHandler handler)
    : Endpoint<GetPlaybackStateRequest, PlaybackStateResult>
{
    public override void Configure()
    {
        Get("/api/audio/playback/state/{fileid}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        GetPlaybackStateRequest request,
        CancellationToken cancellationToken
    )
    {
        var query = new GetPlaybackStateQuery(request.FileId);

        var result = await handler.ExecuteAsync(query, cancellationToken);

        Response = result;
    }
}

public class GetPlaybackStateRequest
{
    public string FileId { get; set; } = string.Empty;
}
