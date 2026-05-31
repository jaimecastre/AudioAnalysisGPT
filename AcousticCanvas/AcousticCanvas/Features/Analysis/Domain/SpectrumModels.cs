namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class SpectrumAnalysis
{
    public required IReadOnlyList<ChannelSpectrumAnalysis> Channels { get; init; }
    public required SpectrumParameters Parameters { get; init; }
    public required TimeRange Region { get; init; }
}

public sealed class ChannelSpectrumAnalysis
{
    public required string ChannelId { get; init; }
    public required string ChannelName { get; init; }
    public required string Quantity { get; init; }
    public required string Unit { get; init; }

    // Columnar arrays: much smaller than array-of-objects for serialization
    public required IReadOnlyList<double> FrequenciesHz { get; init; }
    public required IReadOnlyList<double> Magnitudes { get; init; }
    public required IReadOnlyList<double?> MagnitudesDb { get; init; }

    public double? MaxMagnitude { get; init; }
    public double? MaxMagnitudeDb { get; init; }
    public double? PeakFrequencyHz { get; init; }

    public string? DbUnit { get; init; }
    public double? DbReferenceValue { get; init; }
    public string? DbReferenceUnit { get; init; }
}

public sealed class SpectrumParameters
{
    public required int FftSize { get; init; }
    public required string WindowType { get; init; }
    public required double Overlap { get; init; }
    public required string Averaging { get; init; }
    public required string Scaling { get; init; }
    public required double StartTimeSeconds { get; init; }
    public required double EndTimeSeconds { get; init; }
    public required int BlockCount { get; init; }
}

public sealed class TimeRange
{
    public required double StartSeconds { get; init; }
    public required double EndSeconds { get; init; }
    public required double DurationSeconds { get; init; }
}
