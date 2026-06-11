namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class SignalFile
{
    public required FileInfoAnalysis FileInfo { get; init; }
    public required IReadOnlyList<SignalChannel> Channels { get; init; }
}

public sealed class SignalChannel
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required int SampleRate { get; init; }
    public required long SampleCount { get; init; }

    // What the signal physically represents.
    // Examples: "digital_amplitude", "sound_pressure", "acceleration", "voltage", "unknown"
    public required string Quantity { get; init; }

    // Unit of the actual sample values after import/calibration.
    // Examples: "FS", "Pa", "m/s²", "V", "g"
    public required string Unit { get; init; }

    // Optional dB reference for this channel.
    // For FS: Value = 1.0, Unit = "FS", DbUnit = "dBFS"
    // For sound pressure: Value = 0.00002, Unit = "Pa", DbUnit = "dB SPL"
    public DbReference? DbReference { get; init; }

    // Optional calibration metadata — always present, IsCalibrated = false for raw digital.
    public CalibrationInfo? Calibration { get; init; }

    // Physical metadata: unit kind (digital / Pa / calibrated) and optional acoustic calibration.
    // Null means unknown — behaves the same as DigitalFullScale for analysis purposes.
    public SignalPhysicalMetadata? PhysicalMetadata { get; init; }

    // Raw sample values in the channel's physical unit after import.
    public required float[] Samples { get; init; }
}

public sealed class DbReference
{
    public required double Value { get; init; }
    public required string Unit { get; init; }
    public required string DbUnit { get; init; }
}

public sealed class CalibrationInfo
{
    public required bool IsCalibrated { get; init; }
    public required double Scale { get; init; }
    public required double Offset { get; init; }
    public string? Source { get; init; }
    public string? Notes { get; init; }
}
