using FastEndpoints;
using AcousticCanvas.Features.Playback.Commands;
using AcousticCanvas.Features.Playback.Services;

namespace AcousticCanvas.Features.Playback.Handlers;

public class GetPlaybackStateHandler(PlaybackStateStore stateStore)
    : CommandHandler<GetPlaybackStateQuery, PlaybackStateResult>
{
    public override Task<PlaybackStateResult> ExecuteAsync(GetPlaybackStateQuery query, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var state = stateStore.GetState(query.FileId);

        if (state is null)
        {
            return Task.FromResult(new PlaybackStateResult(
                query.FileId,
                false,
                0,
                0
            ));
        }

        return Task.FromResult(new PlaybackStateResult(
            state.FileId,
            state.IsPlaying,
            state.CurrentTimeSeconds,
            state.DurationSeconds
        ));
    }
}
