using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Analyzers;

/// <summary>
/// Shared helpers for converting between digital samples and acoustic pressure (Pascals / dB SPL).
/// Both SpectrumAnalyzer and SpectrogramAnalyzer must use these helpers — never inline the math.
///
/// Scaling note (FFT context):
/// The FFT pipeline uses a coherent-gain-corrected, power-averaged one-sided spectrum.
/// For sinusoidal signals this produces peak amplitudes per bin, not RMS amplitudes.
/// Use ComputeDbSplFromPeakAmplitude when the input is a peak FFT bin amplitude.
/// Use ComputeDbSpl when the input is already an RMS-equivalent pressure.
/// </summary>
public static class AcousticPressureConverter
{
    /// <summary>Standard acoustic reference pressure: 20 µPa RMS.</summary>
    public const double PressureReferencePa = 20e-6;

    /// <summary>Floor applied before taking log10 to avoid log(0).</summary>
    public const double Epsilon = 1e-20;

    /// <summary>1 / sqrt(2) — converts peak sinusoidal amplitude to RMS amplitude.</summary>
    private const double PeakToRms = 0.70710678118654752;

    // -------------------------------------------------------------------------
    // Scale factor resolution
    // -------------------------------------------------------------------------

    /// <summary>
    /// Returns the Pa-per-sample scale factor implied by the channel's physical metadata.
    /// <list type="bullet">
    /// <item>PressurePascal: 1.0 (samples are already in Pa)</item>
    /// <item>CalibratedPressure: Calibration.PascalsPerFullScale</item>
    /// <item>DigitalFullScale: 1.0 (convention: 0 dBFS = 91 dB SPL, 1 FS = 1 Pa peak)</item>
    /// </list>
    /// </summary>
    public static double GetScaleFactor(SignalPhysicalMetadata metadata) =>
        metadata.UnitKind switch
        {
            SignalUnitKind.PressurePascal => 1.0,

            SignalUnitKind.CalibratedPressure
                when metadata.Calibration is { PascalsPerFullScale: > 0 } => metadata
                .Calibration
                .PascalsPerFullScale,

            SignalUnitKind.CalibratedPressure => throw new InvalidOperationException(
                "dB SPL analysis requires a valid acoustic calibration with PascalsPerFullScale > 0."
            ),

            // DigitalFullScale: apply the universal convention 0 dBFS = 91 dB SPL (1 FS = 1 Pa peak).
            _ => 1.0,
        };

    // -------------------------------------------------------------------------
    // dB SPL conversion
    // -------------------------------------------------------------------------

    /// <summary>
    /// Converts an RMS pressure magnitude (Pa) to dB SPL.
    /// Returns 20 * log10(max(rmsAmplitudePa, epsilon) / 20e-6).
    /// Negative dB SPL values are valid when rmsAmplitudePa &lt; 20 µPa.
    /// </summary>
    public static double ComputeDbSpl(double rmsAmplitudePa)
    {
        var clamped = Math.Max(rmsAmplitudePa, Epsilon);
        return 20.0 * Math.Log10(clamped / PressureReferencePa);
    }

    /// <summary>
    /// Converts a peak sinusoidal FFT bin amplitude (Pa) to dB SPL.
    /// Applies 1/sqrt(2) peak-to-RMS conversion then calls ComputeDbSpl.
    /// Use this when the FFT pipeline produces peak amplitudes (which is the case
    /// for the coherent-gain-corrected power-averaged spectrum in this codebase).
    /// </summary>
    public static double ComputeDbSplFromPeakAmplitude(double peakAmplitudePa) =>
        ComputeDbSpl(peakAmplitudePa * PeakToRms);

    // -------------------------------------------------------------------------
    // Display range mapping
    // -------------------------------------------------------------------------

    /// <summary>
    /// Maps a dB SPL value to a display intensity byte [0, 255] using a fixed physical range.
    /// Values outside [minDbSpl, maxDbSpl] are clamped; the underlying dB SPL value is not altered.
    /// 255 = maxDbSpl (loudest), 0 = minDbSpl (quietest / below floor).
    /// </summary>
    public static byte MapDbSplToByte(double dbSpl, double minDbSpl, double maxDbSpl)
    {
        if (double.IsNaN(dbSpl) || double.IsInfinity(dbSpl))
            return 0;

        var normalized = (dbSpl - minDbSpl) / (maxDbSpl - minDbSpl);
        normalized = Math.Clamp(normalized, 0.0, 1.0);
        return (byte)Math.Round(normalized * 255.0);
    }

    /// <summary>
    /// Maps a display intensity byte [0, 255] back to a dB SPL value using the same range.
    /// Inverse of MapDbSplToByte.
    /// </summary>
    public static double MapByteToDbSpl(byte byteValue, double minDbSpl, double maxDbSpl)
    {
        var normalized = byteValue / 255.0;
        return minDbSpl + normalized * (maxDbSpl - minDbSpl);
    }

    // -------------------------------------------------------------------------
    // Label / metadata helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Returns the UI calibration-state string for a channel.
    /// </summary>
    public static string ResolveCalibrationState(SignalPhysicalMetadata? metadata) =>
        metadata?.UnitKind switch
        {
            SignalUnitKind.PressurePascal when metadata.Calibration?.IsUserAssumed == true =>
                "assumed_pressure",
            SignalUnitKind.PressurePascal => "pressure_signal",
            SignalUnitKind.CalibratedPressure => "calibrated",
            // DigitalFullScale is treated as assumed Pa (0 dBFS = 91 dB SPL convention).
            _ => "assumed_pressure",
        };

    /// <summary>
    /// Returns the Y-axis label for a spectrum plot based on channel metadata.
    /// All channels use dB SPL: pressure channels via calibration, digital channels via
    /// the universal convention 0 dBFS = 91 dB SPL (1 FS = 1 Pa peak).
    /// </summary>
    public static string ResolveYAxisLabel(SignalPhysicalMetadata? metadata) => "dB SPL";

    /// <summary>
    /// Returns the colorbar label for a spectrogram plot based on channel metadata.
    /// All channels use dB SPL per the universal convention 0 dBFS = 91 dB SPL.
    /// </summary>
    public static string ResolveColorbandLabel(SignalPhysicalMetadata? metadata) => "dB SPL";

    /// <summary>
    /// Returns the physical quantity name for a channel.
    /// </summary>
    public static string ResolvePhysicalQuantity(SignalPhysicalMetadata? metadata) =>
        metadata?.UnitKind switch
        {
            SignalUnitKind.CalibratedPressure => "Sound pressure",
            _ => "Sound pressure",
        };
}
