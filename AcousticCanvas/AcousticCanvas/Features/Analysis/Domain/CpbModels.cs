namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class CpbAnalysis
{
    public required CpbParameters Parameters { get; init; }
    public required TimeRange Region { get; init; }
    public required IReadOnlyList<ChannelCpbAnalysis> Channels { get; init; }
}

public sealed class ChannelCpbAnalysis
{
    public required string ChannelId { get; init; }
    public required string ChannelName { get; init; }
    public required string Quantity { get; init; }
    public required string Unit { get; init; }
    public required string? DbUnit { get; init; }
    public required IReadOnlyList<CpbBand> Bands { get; init; }
}

public sealed class CpbBand
{
    public required string Label { get; init; }
    public required double CenterFrequencyHz { get; init; }
    public required double LowerFrequencyHz { get; init; }
    public required double UpperFrequencyHz { get; init; }
    // Contiguous staircase edges for plotting: PlotUpperFrequencyHz of a band equals
    // PlotLowerFrequencyHz of the next band, so the rendered step line has vertical risers.
    public required double PlotLowerFrequencyHz { get; init; }
    public required double PlotUpperFrequencyHz { get; init; }
    public required double Magnitude { get; init; }
    public required double? LevelDb { get; init; }
    public required int BinCount { get; init; }
}

public sealed class CpbParameters
{
    public required string BandMode { get; init; }
    public required int BandsPerOctave { get; init; }
    public required int FftSize { get; init; }
    public required string WindowType { get; init; }
    public required double Overlap { get; init; }
    public required string Averaging { get; init; }
    public required string Scaling { get; init; }
    public required string Method { get; init; }
    public required string Weighting { get; init; }
    public required string WeightingMethod { get; init; }
    public required IReadOnlyList<string> Limitations { get; init; }
    public required double StartTimeSeconds { get; init; }
    public required double EndTimeSeconds { get; init; }
    public required int BlockCount { get; init; }
    public required int SampleRate { get; init; }
}
