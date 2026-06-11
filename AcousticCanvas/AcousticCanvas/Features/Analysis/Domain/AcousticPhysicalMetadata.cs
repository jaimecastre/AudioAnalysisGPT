namespace AcousticCanvas.Features.Analysis.Domain;

/// <summary>
/// Describes the physical unit state of a signal channel.
/// </summary>
public enum SignalUnitKind
{
    /// <summary>
    /// Samples are normalized digital full-scale values in the range [-1, 1].
    /// No physical pressure calibration is present. dB SPL is not available.
    /// </summary>
    DigitalFullScale,

    /// <summary>
    /// Samples are already physical pressure values in Pascals.
    /// dB re 20 µPa can be computed directly.
    /// </summary>
    PressurePascal,

    /// <summary>
    /// Samples are digital full-scale values with a known PascalsPerFullScale calibration factor.
    /// Multiply by PascalsPerFullScale to obtain pressure in Pascals before computing dB SPL.
    /// </summary>
    CalibratedPressure,
}

/// <summary>
/// Acoustic calibration metadata linking digital full-scale samples to physical pressure in Pascals.
/// </summary>
public sealed class AcousticCalibration
{
    /// <summary>
    /// Scale factor: Pa per full-scale unit (0 dBFS = 1 FS).
    /// For example, 1.0 means 1 FS = 1 Pa.
    /// Derived from a calibration recording: knownPressureRmsPa / measuredDigitalRms.
    /// </summary>
    public required double PascalsPerFullScale { get; init; }

    /// <summary>
    /// Human-readable description of how the calibration was obtained.
    /// Examples: "94 dB SPL pistonphone at 1 kHz", "User-provided: 1 FS = 10 Pa".
    /// </summary>
    public string? Source { get; init; }

    /// <summary>
    /// UTC timestamp of when the calibration was established.
    /// </summary>
    public DateTimeOffset? CalibratedAt { get; init; }

    /// <summary>
    /// True when the user explicitly stated "treat samples as Pa" without formal calibration.
    /// Must be displayed as a warning in the UI.
    /// </summary>
    public bool IsUserAssumed { get; init; }
}

/// <summary>
/// Physical signal metadata for a channel — describes its unit state and optional acoustic calibration.
/// </summary>
public sealed class SignalPhysicalMetadata
{
    /// <summary>
    /// Whether the samples are digital full-scale, already in Pa, or calibrated digital.
    /// </summary>
    public required SignalUnitKind UnitKind { get; init; }

    /// <summary>
    /// Calibration data. Required (and must have PascalsPerFullScale > 0) when UnitKind is CalibratedPressure.
    /// May also be present for PressurePascal to document the calibration source.
    /// </summary>
    public AcousticCalibration? Calibration { get; init; }

    /// <summary>
    /// The original unit string from the source file or user input (informational only).
    /// </summary>
    public string? OriginalUnitLabel { get; init; }
}
