using System.Collections.Concurrent;
using AcousticCanvas.Features.Playback.Models;

namespace AcousticCanvas.Features.Playback.Services;

public class PlaybackStateStore
{
    private readonly ConcurrentDictionary<string, PlaybackState> _states = new();

    public PlaybackState GetOrCreateState(string fileId)
    {
        return _states.GetOrAdd(
            fileId,
            id => new PlaybackState
            {
                FileId = id,
                IsPlaying = false,
                CurrentTimeSeconds = 0,
                DurationSeconds = 0,
            }
        );
    }

    public PlaybackState? GetState(string fileId)
    {
        _states.TryGetValue(fileId, out var state);
        return state;
    }

    public void UpdateState(string fileId, Action<PlaybackState> update)
    {
        var state = GetOrCreateState(fileId);
        update(state);
        state.LastUpdateTime = DateTime.UtcNow;
    }

    public void RemoveState(string fileId)
    {
        _states.TryRemove(fileId, out _);
    }
}
