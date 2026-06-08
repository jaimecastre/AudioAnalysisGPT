namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class SoundQualityAnalysis
{
    public required SoundQualityParameters Parameters { get; init; }
    public required TimeRange Region { get; init; }
    public required SoundQualityMetric Loudness { get; init; }
    public required SoundQualityMetric Sharpness { get; init; }
    public required SoundQualityMetric Roughness { get; init; }
}

public sealed class SoundQualityMetric
{
    public required string Name { get; init; }
    public required double Value { get; init; }
    public required string Unit { get; init; }
    public required string Method { get; init; }
}

public sealed class SoundQualityParameters
{
    public required string Method { get; init; }
    public required string Library { get; init; }
    public required double StartTimeSeconds { get; init; }
    public required double EndTimeSeconds { get; init; }
    public required int SampleRate { get; init; }
    public required IReadOnlyList<string> Limitations { get; init; }
}
