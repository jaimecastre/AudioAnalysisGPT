namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class SpectrogramAnalysis
{
    public required SpectrogramParameters Parameters { get; init; }
    public required TimeRange Region { get; init; }
    public required IReadOnlyList<ChannelSpectrogramAnalysis> Channels { get; init; }
}

public sealed class ChannelSpectrogramAnalysis
{
    public required string ChannelId { get; init; }
    public required string ChannelName { get; init; }

    // Number of frequency bins (fftSize / 2 + 1). Used by the frontend to size the display.
    public required int BinCount { get; init; }

    // Number of STFT time frames returned.
    public required int FrameCount { get; init; }

    // Nyquist frequency in Hz (sampleRate / 2).
    public required double NyquistHz { get; init; }

    // Each frame contains frequency-bin amplitudes normalised to bytes in the range 0-255.
    // System.Text.Json serializes each byte[] frame as a base64 string.
    public required IReadOnlyList<byte[]> FrequencyData { get; init; }
}

public sealed class SpectrogramParameters
{
    public required int FftSize { get; init; }
    public required string WindowType { get; init; }
    public required double Overlap { get; init; }
    public required string Scale { get; init; }
    public required double GainDb { get; init; }
    public required double RangeDb { get; init; }
    public required double StartTimeSeconds { get; init; }
    public required double EndTimeSeconds { get; init; }
    public required int FrameCount { get; init; }
    public required int BinCount { get; init; }
    public required int SampleRate { get; init; }
}
