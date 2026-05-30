namespace AcousticCanvas.Features.Playback.Models;

public class PlaybackState
{
    public string FileId { get; set; } = string.Empty;
    public bool IsPlaying { get; set; }
    public double CurrentTimeSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public DateTime LastUpdateTime { get; set; } = DateTime.UtcNow;
}
