using MessagePack;

namespace AcousticCanvas.Features.Analysis.Domain;

/// <summary>
/// MessagePack-serializable spectrum response where each channel contains
/// [x, y] data points instead of separate columnar arrays.
/// </summary>
[MessagePackObject(keyAsPropertyName: true)]
public sealed class SpectrumPointsResponse
{
    public required SpectrumPointsParameters Parameters { get; init; }
    public required SpectrumPointsRegion Region { get; init; }
    public required IReadOnlyList<SpectrumChannelPoints> Channels { get; init; }
}

[MessagePackObject(keyAsPropertyName: true)]
public sealed class SpectrumPointsParameters
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

[MessagePackObject(keyAsPropertyName: true)]
public sealed class SpectrumPointsRegion
{
    public required double StartSeconds { get; init; }
    public required double EndSeconds { get; init; }
    public required double DurationSeconds { get; init; }
}

[MessagePackObject(keyAsPropertyName: true)]
public sealed class SpectrumChannelPoints
{
    public required string ChannelId { get; init; }
    public required string ChannelName { get; init; }

    /// <summary>
    /// [x, y] data points where x = frequencyHz and y = magnitudeDb (or linear magnitude if not calibrated).
    /// </summary>
    public required double[][] Points { get; init; }

    public required string YUnit { get; init; }
    public required string YAxisLabel { get; init; }
    public required string CalibrationState { get; init; }
    public double? MaxMagnitudeDb { get; init; }
    public double? PeakFrequencyHz { get; init; }
    public double? DbReferenceValue { get; init; }
    public string? DbReferenceUnit { get; init; }
    public string? PhysicalQuantity { get; init; }
    public required IReadOnlyList<TonalPeak> TonalPeaks { get; init; }
}
