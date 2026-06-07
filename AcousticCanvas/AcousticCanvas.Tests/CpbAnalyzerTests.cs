using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

public sealed class CpbAnalyzerTests
{
    [Fact]
    public void AWeightingReducesLowFrequencyBandAndRecordsMetadata()
    {
        var channel = BuildSineChannel(frequencyHz: 100.0, sampleRate: 48_000, durationSeconds: 1.0);

        var zWeighted = CpbAnalyzer.Analyze(
            [channel],
            startSeconds: 0.0,
            endSeconds: 1.0,
            bandMode: "third_octave",
            fftSize: 8192,
            overlap: 0.5,
            weighting: "z");

        var aWeighted = CpbAnalyzer.Analyze(
            [channel],
            startSeconds: 0.0,
            endSeconds: 1.0,
            bandMode: "third_octave",
            fftSize: 8192,
            overlap: 0.5,
            weighting: "a");

        var zBand100Hz = FindBand(zWeighted, 100.0);
        var aBand100Hz = FindBand(aWeighted, 100.0);

        Assert.Equal("z", zWeighted.Parameters.Weighting);
        Assert.Equal("a", aWeighted.Parameters.Weighting);
        Assert.Equal("A-weighting IEC 61672 nominal frequency response", aWeighted.Parameters.WeightingMethod);
        Assert.NotNull(zBand100Hz.LevelDb);
        Assert.NotNull(aBand100Hz.LevelDb);
        Assert.True(aBand100Hz.LevelDb < zBand100Hz.LevelDb - 15.0);
    }

    [Fact]
    public void CWeightingKeepsOneKilohertzCloseToZWeighting()
    {
        var channel = BuildSineChannel(frequencyHz: 1000.0, sampleRate: 48_000, durationSeconds: 1.0);

        var zWeighted = CpbAnalyzer.Analyze(
            [channel],
            startSeconds: 0.0,
            endSeconds: 1.0,
            bandMode: "third_octave",
            fftSize: 8192,
            overlap: 0.5,
            weighting: "z");

        var cWeighted = CpbAnalyzer.Analyze(
            [channel],
            startSeconds: 0.0,
            endSeconds: 1.0,
            bandMode: "third_octave",
            fftSize: 8192,
            overlap: 0.5,
            weighting: "c");

        var zBand1kHz = FindBand(zWeighted, 1000.0);
        var cBand1kHz = FindBand(cWeighted, 1000.0);

        Assert.Equal("c", cWeighted.Parameters.Weighting);
        Assert.Equal("C-weighting IEC 61672 nominal frequency response", cWeighted.Parameters.WeightingMethod);
        Assert.NotNull(zBand1kHz.LevelDb);
        Assert.NotNull(cBand1kHz.LevelDb);
        Assert.InRange(cBand1kHz.LevelDb.Value - zBand1kHz.LevelDb.Value, -0.2, 0.2);
    }

    private static SignalChannel BuildSineChannel(double frequencyHz, int sampleRate, double durationSeconds)
    {
        var sampleCount = (int)(sampleRate * durationSeconds);
        var samples = new float[sampleCount];

        for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++)
        {
            samples[sampleIndex] = (float)(0.5 * Math.Sin(2.0 * Math.PI * frequencyHz * sampleIndex / sampleRate));
        }

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = sampleCount,
            Quantity = "digital_amplitude",
            Unit = "FS",
            DbReference = new DbReference
            {
                Value = 1.0,
                Unit = "FS",
                DbUnit = "dBFS",
            },
            Calibration = new CalibrationInfo
            {
                IsCalibrated = false,
                Scale = 1.0,
                Offset = 0.0,
            },
            Samples = samples,
        };
    }

    private static CpbBand FindBand(CpbAnalysis analysis, double centerFrequencyHz)
    {
        return analysis.Channels[0].Bands.Single(band => Math.Abs(band.CenterFrequencyHz - centerFrequencyHz) < 0.01);
    }
}
