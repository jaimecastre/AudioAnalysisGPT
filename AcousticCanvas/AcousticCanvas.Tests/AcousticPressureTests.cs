using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;

namespace AcousticCanvas.Tests;

/// <summary>
/// Verifies the physical-unit / dB SPL pipeline for spectrum and spectrogram analysis.
/// All 16 test cases from the acoustic-calibration specification.
/// </summary>
public sealed class AcousticPressureTests
{
    // -----------------------------------------------------------------
    // 1. Normal WAV import defaults to DigitalFullScale
    // -----------------------------------------------------------------

    [Fact]
    public void WavImportDefaultsToPressurePascalAssumed()
    {
        var wavPath = WriteWavFile(amplitudeFs: 0.1, frequencyHz: 1000.0, sampleRate: 44_100);
        try
        {
            var importer = new WavSignalFileImporter();
            var signalFile = importer.Import(wavPath);
            var meta = signalFile.Channels[0].PhysicalMetadata;

            Assert.NotNull(meta);
            Assert.Equal(SignalUnitKind.PressurePascal, meta!.UnitKind);
            Assert.NotNull(meta.Calibration);
            Assert.True(meta.Calibration!.IsUserAssumed);
            Assert.Equal(1.0, meta.Calibration.PascalsPerFullScale);
        }
        finally
        {
            File.Delete(wavPath);
        }
    }

    // -----------------------------------------------------------------
    // 2. DigitalFullScale WAV cannot produce dB SPL spectrum
    //    (shows dBFS labels, not dB re 20 µPa)
    //    Note: WAV import now defaults to PressurePascal+IsUserAssumed (1 FS = 1 Pa).
    //    DigitalFullScale can still be set explicitly and must not produce SPL labels.
    // -----------------------------------------------------------------

    [Fact]
    public void ExplicitDigitalFullScaleSpectrumShowsDatabaseFsNotSpl()
    {
        var channel = BuildDigitalChannel(amplitudeFs: 0.5, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 1024, 0.5);

        var ch = analysis.Channels[0];
        Assert.Equal("digital_full_scale", ch.CalibrationState);
        Assert.Equal("[dBFS]", ch.YAxisLabel);
        Assert.DoesNotContain("µPa", ch.DbUnit ?? string.Empty);
    }

    // -----------------------------------------------------------------
    // 3. DigitalFullScale WAV cannot produce dB SPL spectrogram
    //    (shows relative-dB colorbar label, not dB SPL)
    // -----------------------------------------------------------------

    [Fact]
    public void ExplicitDigitalFullScaleSpectrogramShowsRelativeDbLabel()
    {
        var channel = BuildDigitalChannel(amplitudeFs: 0.5, frequencyHz: 1000.0);

        var analysis = SpectrogramAnalyzer.Analyze([channel], 0.0, 1.0, 512, 0.5, "linear", 20.0, 80.0);

        var ch = analysis.Channels[0];
        Assert.Equal("digital_full_scale", ch.CalibrationState);
        Assert.Equal("Amplitude [dBFS]", ch.ColorbandLabel);
    }

    // -----------------------------------------------------------------
    // 4. PressurePascal signal renders dB re 20 µPa
    // -----------------------------------------------------------------

    [Fact]
    public void PressurePascalSpectrumShowsDbreference20uPaLabel()
    {
        var channel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 2048, 0.5);

        var ch = analysis.Channels[0];
        Assert.Equal("Level [dB re 20 µPa]", ch.YAxisLabel);
        Assert.Equal("dB re 20 µPa", ch.DbUnit);
        Assert.Equal(AcousticPressureConverter.PressureReferencePa, ch.DbReferenceValue);
        Assert.Equal("Pa", ch.DbReferenceUnit);
    }

    // -----------------------------------------------------------------
    // 5. CalibratedPressure channel uses sample × PascalsPerFullScale
    // -----------------------------------------------------------------

    [Fact]
    public void CalibratedPressureAppliesScaleFactorBeforeDbSpl()
    {
        const double pascalsPerFullScale = 0.1;
        const double amplitudeFs = 0.5;

        // Calibrated channel: 0.5 FS × 0.1 Pa/FS = 0.05 Pa peak
        var calibratedChannel = BuildCalibratedChannel(
            amplitudeFs: amplitudeFs,
            pascalsPerFullScale: pascalsPerFullScale,
            frequencyHz: 1000.0);

        // Equivalent PressurePascal channel: directly 0.05 Pa peak
        var pressureChannel = BuildPressurePascalChannel(
            amplitudePeakPa: amplitudeFs * pascalsPerFullScale,
            frequencyHz: 1000.0);

        var calibratedAnalysis = SpectrumAnalyzer.Analyze([calibratedChannel], 0.0, 1.0, 2048, 0.5);
        var pressureAnalysis = SpectrumAnalyzer.Analyze([pressureChannel], 0.0, 1.0, 2048, 0.5);

        Assert.NotNull(calibratedAnalysis.Channels[0].MaxMagnitudeDb);
        Assert.NotNull(pressureAnalysis.Channels[0].MaxMagnitudeDb);

        var calibratedDbSpl = calibratedAnalysis.Channels[0].MaxMagnitudeDb!.Value;
        var pressureDbSpl = pressureAnalysis.Channels[0].MaxMagnitudeDb!.Value;

        Assert.InRange(calibratedDbSpl, pressureDbSpl - 0.5, pressureDbSpl + 0.5);
    }

    // -----------------------------------------------------------------
    // 6. Missing calibration throws a clear InvalidOperationException
    // -----------------------------------------------------------------

    [Fact]
    public void CalibratedPressureWithNullCalibrationThrows()
    {
        var metadataNoCalibration = new SignalPhysicalMetadata
        {
            UnitKind = SignalUnitKind.CalibratedPressure,
            Calibration = null,
        };

        var ex = Assert.Throws<InvalidOperationException>(
            () => AcousticPressureConverter.GetScaleFactor(metadataNoCalibration));
        Assert.Contains("PascalsPerFullScale", ex.Message);
    }

    [Fact]
    public void DigitalFullScaleGetScaleFactorThrows()
    {
        var metadata = new SignalPhysicalMetadata { UnitKind = SignalUnitKind.DigitalFullScale };

        var ex = Assert.Throws<InvalidOperationException>(
            () => AcousticPressureConverter.GetScaleFactor(metadata));
        Assert.Contains("dB SPL", ex.Message);
    }

    // -----------------------------------------------------------------
    // 7. 20 µPa maps to 0 dB SPL
    // -----------------------------------------------------------------

    [Fact]
    public void TwentyMicroPascalsMapsToZeroDbSpl()
    {
        var result = AcousticPressureConverter.ComputeDbSpl(20e-6);
        Assert.Equal(0.0, result, precision: 6);
    }

    // -----------------------------------------------------------------
    // 8. 1 Pa RMS maps to approximately 94 dB SPL
    // -----------------------------------------------------------------

    [Fact]
    public void OnePascalRmsMapsToApproximately94DbSpl()
    {
        // A 1 Pa RMS sine has peak amplitude = sqrt(2) ≈ 1.41421 Pa.
        // The FFT pipeline produces peak amplitudes per bin.
        // AcousticPressureConverter.ComputeDbSplFromPeakAmplitude applies peak-to-RMS (÷√2)
        // so the result should be 20 × log10(1 / 20e-6) ≈ 93.98 dB SPL.
        const double oneRmsPeakPa = 1.41421356237; // sqrt(2)
        var channel = BuildPressurePascalChannel(amplitudePeakPa: oneRmsPeakPa, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 4096, 0.5);

        Assert.NotNull(analysis.Channels[0].MaxMagnitudeDb);
        Assert.InRange(analysis.Channels[0].MaxMagnitudeDb!.Value, 92.0, 96.0);
    }

    // -----------------------------------------------------------------
    // 9. Negative dB SPL values are allowed
    // -----------------------------------------------------------------

    [Fact]
    public void PressureBelowReferenceLevelProducesNegativeDbSpl()
    {
        // 1 nPa peak → RMS ≈ 0.71 nPa → far below 20 µPa → very negative dB SPL
        const double verySmallPressurePa = 1e-9;
        var channel = BuildPressurePascalChannel(amplitudePeakPa: verySmallPressurePa, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 2048, 0.5);

        Assert.NotNull(analysis.Channels[0].MaxMagnitudeDb);
        Assert.True(analysis.Channels[0].MaxMagnitudeDb!.Value < 0.0,
            $"Expected negative dB SPL but got {analysis.Channels[0].MaxMagnitudeDb!.Value}");
    }

    // -----------------------------------------------------------------
    // 10. Spectrum does not divide by global maximum
    // -----------------------------------------------------------------

    [Fact]
    public void SpectrumDbSplDoesNotNormalizeToGlobalMaximum()
    {
        const double frequencyHz = 1000.0;
        var loudChannel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: frequencyHz);
        var quietChannel = BuildPressurePascalChannel(amplitudePeakPa: 0.01, frequencyHz: frequencyHz);

        var loudAnalysis = SpectrumAnalyzer.Analyze([loudChannel], 0.0, 1.0, 2048, 0.5);
        var quietAnalysis = SpectrumAnalyzer.Analyze([quietChannel], 0.0, 1.0, 2048, 0.5);

        var loudDbSpl = loudAnalysis.Channels[0].MaxMagnitudeDb!.Value;
        var quietDbSpl = quietAnalysis.Channels[0].MaxMagnitudeDb!.Value;

        // Loud is 40 dB louder (amplitude ratio 100 → 40 dB).
        // If normalization were applied, both would peak at 0 dB relative.
        var difference = loudDbSpl - quietDbSpl;
        Assert.InRange(difference, 38.0, 42.0);
    }

    // -----------------------------------------------------------------
    // 11. Spectrogram does not divide by global maximum
    // -----------------------------------------------------------------

    [Fact]
    public void SpectrogramDbSplDoesNotNormalizeToGlobalMaximum()
    {
        const double frequencyHz = 2000.0;
        const double minDbSpl = 20.0;
        const double maxDbSpl = 100.0;

        var loudChannel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: frequencyHz);
        var quietChannel = BuildPressurePascalChannel(amplitudePeakPa: 0.01, frequencyHz: frequencyHz);

        var loudAnalysis = SpectrogramAnalyzer.Analyze(
            [loudChannel], 0.0, 1.0, 512, 0.5, "linear", 20.0, 80.0, minDbSpl, maxDbSpl);
        var quietAnalysis = SpectrogramAnalyzer.Analyze(
            [quietChannel], 0.0, 1.0, 512, 0.5, "linear", 20.0, 80.0, minDbSpl, maxDbSpl);

        // Find max byte in each spectrogram (first frame for simplicity).
        var loudMax = loudAnalysis.Channels[0].FrequencyData[0].Max();
        var quietMax = quietAnalysis.Channels[0].FrequencyData[0].Max();

        // If global-max normalization were used, both would have max byte = 255.
        // With fixed SPL range [20..100], the loud signal (≈94 dB SPL peak) will have
        // higher max byte than the quiet signal (≈54 dB SPL peak).
        Assert.True(loudMax > quietMax,
            $"Loud spectrogram max byte {loudMax} should exceed quiet max byte {quietMax}");
    }

    // -----------------------------------------------------------------
    // 12. Spectrogram color mapping clamps only display intensity
    // -----------------------------------------------------------------

    [Fact]
    public void MapDbSplToByteClampsBytesNotDbValues()
    {
        // Values far outside [minDb, maxDb] are clamped at the byte level.
        Assert.Equal(255, AcousticPressureConverter.MapDbSplToByte(9999.0, 20.0, 100.0));
        Assert.Equal(0, AcousticPressureConverter.MapDbSplToByte(-9999.0, 20.0, 100.0));
        Assert.Equal(0, AcousticPressureConverter.MapDbSplToByte(double.NaN, 20.0, 100.0));
        Assert.Equal(0, AcousticPressureConverter.MapDbSplToByte(double.NegativeInfinity, 20.0, 100.0));

        // 60 dB in [20..100] range: (60-20)/(100-20) = 0.5 → byte = round(0.5*255) = 128
        Assert.Equal(128, AcousticPressureConverter.MapDbSplToByte(60.0, 20.0, 100.0));

        // The underlying dB value (say -50 dB SPL) is physically meaningful and not discarded.
        Assert.Equal(0, AcousticPressureConverter.MapDbSplToByte(-50.0, 20.0, 100.0));
    }

    // -----------------------------------------------------------------
    // 13. Spectrum Y-axis label is "Level [dB re 20 µPa]"
    // -----------------------------------------------------------------

    [Fact]
    public void SpectrumYAxisLabelContains20uPaForPressureChannel()
    {
        var channel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 1024, 0.5);

        Assert.Equal("Level [dB re 20 µPa]", analysis.Channels[0].YAxisLabel);
    }

    [Fact]
    public void SpectrumYAxisLabelIsDbFsForDigitalChannel()
    {
        var channel = BuildDigitalChannel(amplitudeFs: 0.5, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 1024, 0.5);

        Assert.Equal("[dBFS]", analysis.Channels[0].YAxisLabel);
    }

    // -----------------------------------------------------------------
    // 14. Spectrogram colorbar label uses calibrated pressure reference wording.
    // -----------------------------------------------------------------

    [Fact]
    public void SpectrogramColorbandLabelIsDbSplForPressureChannel()
    {
        var channel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: 1000.0);

        var analysis = SpectrogramAnalyzer.Analyze([channel], 0.0, 1.0, 512, 0.5, "linear", 20.0, 80.0);

        Assert.Equal("Level [dB re 20 µPa]", analysis.Channels[0].ColorbandLabel);
    }

    // -----------------------------------------------------------------
    // 15. User-assumed Pa mode shows a warning via CalibrationState
    // -----------------------------------------------------------------

    [Fact]
    public void AssumedPressureChannelCalibrationStateIsAssumedPressure()
    {
        var channel = BuildAssumedPressureChannel(amplitudePeakPa: 0.1, frequencyHz: 1000.0);

        var spectrumAnalysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 1024, 0.5);
        var spectrogramAnalysis = SpectrogramAnalyzer.Analyze([channel], 0.0, 1.0, 512, 0.5, "linear", 20.0, 80.0);

        Assert.Equal("assumed_pressure", spectrumAnalysis.Channels[0].CalibrationState);
        Assert.Equal("assumed_pressure", spectrogramAnalysis.Channels[0].CalibrationState);
    }

    // -----------------------------------------------------------------
    // 16. Metadata includes quantity, unit, reference, and calibration state
    // -----------------------------------------------------------------

    [Fact]
    public void PressureChannelSpectrumIncludesFullAcousticMetadata()
    {
        var channel = BuildPressurePascalChannel(amplitudePeakPa: 1.0, frequencyHz: 1000.0);

        var analysis = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 2048, 0.5);

        var ch = analysis.Channels[0];
        Assert.Equal("Sound pressure", ch.PhysicalQuantity);
        Assert.Equal(AcousticPressureConverter.PressureReferencePa, ch.DbReferenceValue);
        Assert.Equal("Pa", ch.DbReferenceUnit);
        Assert.Equal("dB re 20 µPa", ch.DbUnit);
        Assert.Equal("pressure_signal", ch.CalibrationState);
        Assert.Equal("Level [dB re 20 µPa]", ch.YAxisLabel);
    }

    // =================================================================
    // Helpers
    // =================================================================

    private const int DefaultSampleRate = 48_000;
    private const double DefaultDurationSeconds = 1.0;

    private static SignalChannel BuildDigitalChannel(
        double amplitudeFs,
        double frequencyHz,
        int sampleRate = DefaultSampleRate,
        double durationSeconds = DefaultDurationSeconds)
    {
        var samples = BuildSineSamples(amplitudeFs, frequencyHz, sampleRate, durationSeconds);

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = samples.Length,
            Quantity = "digital_amplitude",
            Unit = "FS",
            DbReference = new DbReference { Value = 1.0, Unit = "FS", DbUnit = "dBFS" },
            PhysicalMetadata = new SignalPhysicalMetadata { UnitKind = SignalUnitKind.DigitalFullScale },
            Samples = samples,
        };
    }

    private static SignalChannel BuildPressurePascalChannel(
        double amplitudePeakPa,
        double frequencyHz,
        int sampleRate = DefaultSampleRate,
        double durationSeconds = DefaultDurationSeconds)
    {
        var samples = BuildSineSamples(amplitudePeakPa, frequencyHz, sampleRate, durationSeconds);

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = samples.Length,
            Quantity = "sound_pressure",
            Unit = "Pa",
            DbReference = new DbReference
            {
                Value = AcousticPressureConverter.PressureReferencePa,
                Unit = "Pa",
                DbUnit = "dB re 20 µPa",
            },
            PhysicalMetadata = new SignalPhysicalMetadata { UnitKind = SignalUnitKind.PressurePascal },
            Samples = samples,
        };
    }

    private static SignalChannel BuildCalibratedChannel(
        double amplitudeFs,
        double pascalsPerFullScale,
        double frequencyHz,
        int sampleRate = DefaultSampleRate,
        double durationSeconds = DefaultDurationSeconds)
    {
        var samples = BuildSineSamples(amplitudeFs, frequencyHz, sampleRate, durationSeconds);

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = samples.Length,
            Quantity = "digital_amplitude",
            Unit = "FS",
            PhysicalMetadata = new SignalPhysicalMetadata
            {
                UnitKind = SignalUnitKind.CalibratedPressure,
                Calibration = new AcousticCalibration
                {
                    PascalsPerFullScale = pascalsPerFullScale,
                    Source = "test",
                },
            },
            Samples = samples,
        };
    }

    private static SignalChannel BuildAssumedPressureChannel(
        double amplitudePeakPa,
        double frequencyHz,
        int sampleRate = DefaultSampleRate,
        double durationSeconds = DefaultDurationSeconds)
    {
        var samples = BuildSineSamples(amplitudePeakPa, frequencyHz, sampleRate, durationSeconds);

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = samples.Length,
            Quantity = "sound_pressure",
            Unit = "Pa",
            PhysicalMetadata = new SignalPhysicalMetadata
            {
                UnitKind = SignalUnitKind.PressurePascal,
                Calibration = new AcousticCalibration
                {
                    PascalsPerFullScale = 1.0,
                    IsUserAssumed = true,
                    Source = "User-assumed: samples treated as Pa",
                },
            },
            Samples = samples,
        };
    }

    private static float[] BuildSineSamples(
        double amplitude,
        double frequencyHz,
        int sampleRate,
        double durationSeconds)
    {
        var sampleCount = (int)(sampleRate * durationSeconds);
        var samples = new float[sampleCount];

        for (var i = 0; i < sampleCount; i++)
        {
            samples[i] = (float)(amplitude * Math.Sin(2.0 * Math.PI * frequencyHz * i / sampleRate));
        }

        return samples;
    }

    /// <summary>
    /// Writes a 16-bit PCM WAV with a sine wave to a temp file.
    /// Returns the temp file path; caller is responsible for deleting it.
    /// </summary>
    private static string WriteWavFile(
        double amplitudeFs,
        double frequencyHz,
        int sampleRate,
        double durationSeconds = 1.0)
    {
        var sampleCount = (int)(sampleRate * durationSeconds);
        using var memoryStream = new MemoryStream();
        using var writer = new BinaryWriter(memoryStream);
        var dataByteCount = sampleCount * sizeof(short);

        writer.Write("RIFF"u8.ToArray());
        writer.Write(36 + dataByteCount);
        writer.Write("WAVE"u8.ToArray());
        writer.Write("fmt "u8.ToArray());
        writer.Write(16);
        writer.Write((short)1);
        writer.Write((short)1);
        writer.Write(sampleRate);
        writer.Write(sampleRate * sizeof(short));
        writer.Write((short)sizeof(short));
        writer.Write((short)16);
        writer.Write("data"u8.ToArray());
        writer.Write(dataByteCount);

        for (var i = 0; i < sampleCount; i++)
        {
            var sample = amplitudeFs * Math.Sin(2.0 * Math.PI * frequencyHz * i / sampleRate);
            writer.Write((short)Math.Round(sample * short.MaxValue));
        }

        var path = Path.GetTempFileName() + ".wav";
        File.WriteAllBytes(path, memoryStream.ToArray());
        return path;
    }
}
