namespace AcousticCanvas.Features.Analysis.Domain;

public enum SpectrumWindowType
{
    Rectangular,
    Hann
}

public sealed class FileInfoAnalysis
{
    public required string FileName { get; init; }
    public required string FileExtension { get; init; }
    public required long FileSizeBytes { get; init; }
    public required string ContainerFormat { get; init; }
    public string? EncodingFormat { get; init; }
    public required double DurationSeconds { get; init; }
    public int? SampleRate { get; init; }
    public required int ChannelCount { get; init; }
    public int? BitDepth { get; init; }
    public long? TotalFrames { get; init; }
    public long? TotalSamples { get; init; }
}

public sealed class ChannelLevelAnalysis
{
    public required string ChannelId { get; init; }
    public required string ChannelName { get; init; }
    public required string Quantity { get; init; }
    public required string Unit { get; init; }

    public required double Min { get; init; }
    public required double Max { get; init; }
    public required double Peak { get; init; }
    public required double Rms { get; init; }
    public required double DcOffset { get; init; }

    // Only set when a valid DbReference exists.
    public double? PeakDb { get; init; }
    public double? RmsDb { get; init; }
    public string? DbUnit { get; init; }
    public double? DbReferenceValue { get; init; }
    public string? DbReferenceUnit { get; init; }

    // Only set when RMS > 0.
    public double? CrestFactor { get; init; }
    public double? CrestFactorDb { get; init; }

    public required bool IsCalibrated { get; init; }
}

public sealed class LevelAnalysis
{
    public required IReadOnlyList<ChannelLevelAnalysis> Channels { get; init; }

    // Combined result from averaging all channels per frame. Null if single-channel.
    public ChannelLevelAnalysis? Combined { get; init; }
}

public sealed class AnalysisResult
{
    public required FileInfoAnalysis FileInfo { get; init; }
    public required LevelAnalysis Level { get; init; }
    public SpectrumAnalysis? Spectrum { get; init; }
    public required DateTimeOffset AnalyzedAt { get; init; }
}
