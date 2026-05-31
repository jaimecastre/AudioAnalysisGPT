namespace AcousticCanvas.Features.Waveform.Models;

public class WaveformResponse
{
    public double DurationSeconds { get; set; }
    public int SampleRate { get; set; }
    public int Channels { get; set; }
    public double GlobalMinFs { get; set; }
    public double GlobalMaxFs { get; set; }

    // Interleaved per-bucket peaks for one mono channel: [min0, max0, min1, max1, ...]
    // This is the format wavesurfer.js expects for precomputed peaks.
    public float[] Peaks { get; set; } = [];
}
