using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

/// <summary>
/// Tests SpectrumAnalyzer beyond the pressure/calibration pipeline (covered by AcousticPressureTests).
/// Covers: peak detection, tonal peaks, region windowing, multi-channel, digital dB path.
/// </summary>
public sealed class SpectrumAnalyzerTests
{
    private const int DefaultSampleRate = 48_000;

    [Fact]
    public void PeakFrequencyMatchesInputSineWithinOneBin()
    {
        const double targetHz = 1000.0;
        const int fftSize = 4096;
        var channel = BuildDigitalSineChannel(0.5, targetHz, DefaultSampleRate, 1.0);

        var result = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, fftSize, 0.5);

        Assert.NotNull(result.Channels[0].PeakFrequencyHz);
        var binSpacingHz = (double)DefaultSampleRate / fftSize;
        var frequencyError = Math.Abs(result.Channels[0].PeakFrequencyHz!.Value - targetHz);
        Assert.True(frequencyError < binSpacingHz,
            $"Peak frequency {result.Channels[0].PeakFrequencyHz} should be within one bin ({binSpacingHz} Hz) of {targetHz} Hz");
    }

    [Fact]
    public void HigherAmplitudeProducesHigherMagnitude()
    {
        var loud = BuildDigitalSineChannel(0.8, 1000.0, DefaultSampleRate, 1.0);
        var quiet = BuildDigitalSineChannel(0.1, 1000.0, DefaultSampleRate, 1.0);

        var loudResult = SpectrumAnalyzer.Analyze([loud], 0.0, 1.0, 4096, 0.5);
        var quietResult = SpectrumAnalyzer.Analyze([quiet], 0.0, 1.0, 4096, 0.5);

        Assert.True(loudResult.Channels[0].MaxMagnitude > quietResult.Channels[0].MaxMagnitude);
    }

    [Fact]
    public void TonalPeakDetectedForPureSine()
    {
        var channel = BuildDigitalSineChannel(0.5, 1000.0, DefaultSampleRate, 1.0);

        var result = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 8192, 0.5);

        Assert.NotEmpty(result.Channels[0].TonalPeaks);
        var strongestPeak = result.Channels[0].TonalPeaks[0];
        Assert.True(strongestPeak.ProminenceDb > 6.0,
            $"Expected prominence > 6 dB but got {strongestPeak.ProminenceDb}");
        Assert.InRange(strongestPeak.FrequencyHz, 990.0, 1010.0);
    }

    [Fact]
    public void MultiChannelProducesResultPerChannel()
    {
        var channel1 = BuildDigitalSineChannel(0.5, 440.0, DefaultSampleRate, 1.0, "ch1", "Left");
        var channel2 = BuildDigitalSineChannel(0.3, 880.0, DefaultSampleRate, 1.0, "ch2", "Right");

        var result = SpectrumAnalyzer.Analyze([channel1, channel2], 0.0, 1.0, 4096, 0.5);

        Assert.Equal(2, result.Channels.Count);
        Assert.Equal("ch1", result.Channels[0].ChannelId);
        Assert.Equal("ch2", result.Channels[1].ChannelId);
    }

    [Fact]
    public void RegionWindowingRestrictsAnalysisToRegion()
    {
        // Build a 2-second signal: silence in [0,1), sine in [1,2)
        var sampleCount = DefaultSampleRate * 2;
        var samples = new float[sampleCount];
        for (var i = DefaultSampleRate; i < sampleCount; i++)
        {
            samples[i] = (float)(0.5 * Math.Sin(2.0 * Math.PI * 1000.0 * i / DefaultSampleRate));
        }

        var channel = BuildChannelFromSamples(samples, DefaultSampleRate);

        // Analyze only the silent first half
        var silentResult = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 2048, 0.5);
        // Analyze only the sine second half
        var sineResult = SpectrumAnalyzer.Analyze([channel], 1.0, 2.0, 2048, 0.5);

        Assert.True(sineResult.Channels[0].MaxMagnitude > silentResult.Channels[0].MaxMagnitude! * 10,
            "Sine region should have much higher magnitude than silent region");
    }

    [Fact]
    public void ParametersRecordCorrectValues()
    {
        var channel = BuildDigitalSineChannel(0.5, 440.0, DefaultSampleRate, 1.0);

        var result = SpectrumAnalyzer.Analyze([channel], 0.5, 1.0, 2048, 0.75);

        Assert.Equal(2048, result.Parameters.FftSize);
        Assert.Equal("hann", result.Parameters.WindowType);
        Assert.Equal(0.75, result.Parameters.Overlap);
        Assert.Equal(0.5, result.Parameters.StartTimeSeconds);
        Assert.Equal(1.0, result.Parameters.EndTimeSeconds);
    }

    [Fact]
    public void RegionRecordsCorrectTimeRange()
    {
        var channel = BuildDigitalSineChannel(0.5, 440.0, DefaultSampleRate, 2.0);

        var result = SpectrumAnalyzer.Analyze([channel], 0.3, 1.7, 1024, 0.5);

        Assert.Equal(0.3, result.Region.StartSeconds);
        Assert.Equal(1.7, result.Region.EndSeconds);
        Assert.Equal(1.4, result.Region.DurationSeconds, precision: 6);
    }

    [Fact]
    public void DigitalChannelUsesDbSplLabel()
    {
        var channel = BuildDigitalSineChannel(0.5, 1000.0, DefaultSampleRate, 1.0);

        var result = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 2048, 0.5);

        Assert.Equal("dB SPL", result.Channels[0].YAxisLabel);
        Assert.Equal("assumed_pressure", result.Channels[0].CalibrationState);
    }

    [Fact]
    public void RectangularWindowProducesDifferentResultThanHann()
    {
        var channel = BuildDigitalSineChannel(0.5, 1000.0, DefaultSampleRate, 1.0);

        var hannResult = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 4096, 0.5, SpectrumWindowType.Hann);
        var rectResult = SpectrumAnalyzer.Analyze([channel], 0.0, 1.0, 4096, 0.5, SpectrumWindowType.Rectangular);

        // Peak magnitudes should differ due to windowing gain correction
        Assert.NotEqual(
            hannResult.Channels[0].MaxMagnitude,
            rectResult.Channels[0].MaxMagnitude);
    }

    // =================================================================
    // Helpers
    // =================================================================

    private static SignalChannel BuildDigitalSineChannel(
        double amplitudeFs,
        double frequencyHz,
        int sampleRate,
        double durationSeconds,
        string channelId = "ch1",
        string channelName = "Mono")
    {
        var samples = BuildSineSamples(amplitudeFs, frequencyHz, sampleRate, durationSeconds);

        return BuildChannelFromSamples(samples, sampleRate, channelId, channelName);
    }

    private static SignalChannel BuildChannelFromSamples(
        float[] samples,
        int sampleRate,
        string channelId = "ch1",
        string channelName = "Mono")
    {
        return new SignalChannel
        {
            Id = channelId,
            Name = channelName,
            SampleRate = sampleRate,
            SampleCount = samples.Length,
            Quantity = "digital_amplitude",
            Unit = "FS",
            DbReference = new DbReference { Value = 1.0, Unit = "FS", DbUnit = "dBFS" },
            PhysicalMetadata = new SignalPhysicalMetadata { UnitKind = SignalUnitKind.DigitalFullScale },
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
}
