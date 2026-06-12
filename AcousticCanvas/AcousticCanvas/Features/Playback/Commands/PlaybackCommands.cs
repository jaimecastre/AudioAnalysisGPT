using FastEndpoints;

namespace AcousticCanvas.Features.Playback.Commands;

public record ControlPlaybackCommand(string FileId, string Action, double TimeSeconds)
    : ICommand<PlaybackStateResult>;

public record GetPlaybackStateQuery(string FileId) : ICommand<PlaybackStateResult>;

public record PlaybackStateResult(
    string FileId,
    bool IsPlaying,
    double CurrentTimeSeconds,
    double DurationSeconds
);
