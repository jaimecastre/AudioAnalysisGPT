using AcousticCanvas.Features.Playback.Commands;
using AcousticCanvas.Features.Playback.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Playback.Handlers;

public class PlaybackControlHandler(PlaybackStateStore stateStore)
    : CommandHandler<ControlPlaybackCommand, PlaybackStateResult>
{
    public override Task<PlaybackStateResult> ExecuteAsync(
        ControlPlaybackCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        var state = stateStore.GetOrCreateState(command.FileId);

        if (command.Action == "play")
        {
            state.IsPlaying = true;
        }
        else if (command.Action == "pause")
        {
            state.IsPlaying = false;
        }
        else if (command.Action == "seek")
        {
            state.CurrentTimeSeconds = Math.Clamp(command.TimeSeconds, 0, state.DurationSeconds);
        }
        else if (command.Action == "stop")
        {
            state.IsPlaying = false;
            state.CurrentTimeSeconds = 0;
        }

        state.LastUpdateTime = DateTime.UtcNow;

        var result = new PlaybackStateResult(
            state.FileId,
            state.IsPlaying,
            state.CurrentTimeSeconds,
            state.DurationSeconds
        );

        return Task.FromResult(result);
    }
}
