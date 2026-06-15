using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

/// <summary>
/// Tests SpectrogramAnalyzer: frame output, byte encoding, capping,
/// scale modes, region clamping, multi-channel, and parameter recording.
/// </summary>
public sealed class SpectrogramAnalyzerTests
{
    private const int DefaultSampleRate = 48_000;
    private const int DefaultFftSize = 512;
    private const double DefaultOverlap = 0.75;
    private const double DefaultGainDb = 20.0;
    private const double DefaultRangeDb = 80.0;

    [Fact]
    public void ProducesAtLeastOneFrame()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        var result = Analyze(channel);

        Assert.NotEmpty(result.Channels);
        Assert.True(result.Channels[0].FrameCount >= 1);
        Assert.NotEmpty(result.Channels[0].FrequencyData);
    }

    [Fact]
    public void FrameCountDoesNotExceedMaxFramesCap()
    {
        // A long signal with small FFT + high overlap would produce many frames
        var channel = BuildSineChannel(0.5, 440.0, 30.0);

        var result = SpectrogramAnalyzer.Analyze(
            [channel], 0.0, 30.0, 256, 0.75, "linear", DefaultGainDb, DefaultRangeDb);

        Assert.True(result.Channels[0].FrameCount <= 1000,
            $"Frame count {result.Channels[0].FrameCount} exceeds the 1000 cap");
    }

    [Fact]
    public void ByteValuesAreInZeroTo255Range()
    {
        var channel = BuildSineChannel(0.8, 1000.0, 1.0);

        var result = Analyze(channel);

        foreach (var frame in result.Channels[0].FrequencyData)
        {
            foreach (var byteVal in frame)
            {
                Assert.InRange(byteVal, (byte)0, (byte)255);
            }
        }
    }

    [Fact]
    public void LoudSignalHasHigherMaxBytesThanQuietSignal()
    {
        var loud = BuildSineChannel(0.9, 1000.0, 1.0);
        var quiet = BuildSineChannel(0.001, 1000.0, 1.0);

        var loudResult = Analyze(loud);
        var quietResult = Analyze(quiet);

        var loudMaxByte = MaxByteInSpectrogram(loudResult.Channels[0]);
        var quietMaxByte = MaxByteInSpectrogram(quietResult.Channels[0]);

        // Fixed dB SPL range maps loud signals to high bytes and quiet to lower bytes.
        Assert.True(loudMaxByte > quietMaxByte,
            $"Loud max byte {loudMaxByte} should exceed quiet max byte {quietMaxByte}");
    }

    [Fact]
    public void SilentSignalProducesAllZeroBytes()
    {
        var sampleCount = DefaultSampleRate;
        var silence = new float[sampleCount];
        var channel = BuildChannelFromSamples(silence);

        var result = Analyze(channel);

        var maxByte = MaxByteInSpectrogram(result.Channels[0]);
        Assert.Equal(0, maxByte);
    }

    [Fact]
    public void MultiChannelProducesResultPerChannel()
    {
        var ch1 = BuildSineChannel(0.5, 440.0, 1.0, "ch1", "Left");
        var ch2 = BuildSineChannel(0.3, 880.0, 1.0, "ch2", "Right");

        var result = SpectrogramAnalyzer.Analyze(
            [ch1, ch2], 0.0, 1.0, DefaultFftSize, DefaultOverlap,
            "linear", DefaultGainDb, DefaultRangeDb);

        Assert.Equal(2, result.Channels.Count);
        Assert.Equal("ch1", result.Channels[0].ChannelId);
        Assert.Equal("ch2", result.Channels[1].ChannelId);
    }

    [Fact]
    public void BinCountMatchesFftSizeFormula()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        var result = Analyze(channel);

        var expectedBinCount = DefaultFftSize / 2 + 1;
        Assert.Equal(expectedBinCount, result.Channels[0].BinCount);
        Assert.Equal(expectedBinCount, result.Parameters.BinCount);

        // Each frame byte array should also have binCount entries
        Assert.Equal(expectedBinCount, result.Channels[0].FrequencyData[0].Length);
    }

    [Fact]
    public void NyquistHzIsHalfSampleRate()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        var result = Analyze(channel);

        Assert.Equal(DefaultSampleRate / 2.0, result.Channels[0].NyquistHz);
    }

    [Fact]
    public void RegionIsClamped()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        // Request region beyond signal duration
        var result = SpectrogramAnalyzer.Analyze(
            [channel], -1.0, 5.0, DefaultFftSize, DefaultOverlap,
            "linear", DefaultGainDb, DefaultRangeDb);

        Assert.Equal(0.0, result.Region.StartSeconds);
        Assert.Equal(1.0, result.Region.EndSeconds, precision: 2);
    }

    [Fact]
    public void ParametersRecordCorrectValues()
    {
        var channel = BuildSineChannel(0.5, 440.0, 2.0);

        var result = SpectrogramAnalyzer.Analyze(
            [channel], 0.5, 1.5, 1024, 0.5, "mel", 15.0, 60.0);

        Assert.Equal(1024, result.Parameters.FftSize);
        Assert.Equal("hann", result.Parameters.WindowType);
        Assert.Equal(0.5, result.Parameters.Overlap);
        Assert.Equal("mel", result.Parameters.Scale);
        Assert.Equal(15.0, result.Parameters.GainDb);
        Assert.Equal(60.0, result.Parameters.RangeDb);
    }

    [Fact]
    public void GainDbAndRangeDbAreClamped()
    {
        var channel = BuildSineChannel(0.5, 440.0, 1.0);

        var result = SpectrogramAnalyzer.Analyze(
            [channel], 0.0, 1.0, DefaultFftSize, DefaultOverlap,
            "linear", 999.0, 999.0);

        // GainDb clamps to [-10, 30], RangeDb clamps to [20, 120]
        Assert.Equal(30.0, result.Parameters.GainDb);
        Assert.Equal(120.0, result.Parameters.RangeDb);
    }

    [Fact]
    public void DigitalChannelUsesDbSplColorbandLabel()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        var result = Analyze(channel);

        Assert.Equal("dB SPL", result.Channels[0].ColorbandLabel);
        Assert.Equal("assumed_pressure", result.Channels[0].CalibrationState);
    }

    [Fact]
    public void TimeAndFrequencyAxisTicksArePopulated()
    {
        var channel = BuildSineChannel(0.5, 1000.0, 1.0);

        var result = Analyze(channel);

        Assert.NotEmpty(result.TimeAxisTicks);
        Assert.NotEmpty(result.FrequencyAxisTicks);
    }

    // =================================================================
    // Helpers
    // =================================================================

    private static SpectrogramAnalysis Analyze(SignalChannel channel)
    {
        var durationSeconds = (double)channel.Samples.Length / channel.SampleRate;
        return SpectrogramAnalyzer.Analyze(
            [channel], 0.0, durationSeconds, DefaultFftSize, DefaultOverlap,
            "linear", DefaultGainDb, DefaultRangeDb);
    }

    private static int MaxByteInSpectrogram(ChannelSpectrogramAnalysis channel)
    {
        var max = 0;
        foreach (var frame in channel.FrequencyData)
        {
            foreach (var b in frame)
            {
                if (b > max) max = b;
            }
        }
        return max;
    }

    private static SignalChannel BuildSineChannel(
        double amplitudeFs,
        double frequencyHz,
        double durationSeconds,
        string channelId = "ch1",
        string channelName = "Mono")
    {
        var sampleCount = (int)(DefaultSampleRate * durationSeconds);
        var samples = new float[sampleCount];

        for (var i = 0; i < sampleCount; i++)
        {
            samples[i] = (float)(amplitudeFs * Math.Sin(2.0 * Math.PI * frequencyHz * i / DefaultSampleRate));
        }

        return BuildChannelFromSamples(samples, channelId, channelName);
    }

    private static SignalChannel BuildChannelFromSamples(
        float[] samples,
        string channelId = "ch1",
        string channelName = "Mono")
    {
        return new SignalChannel
        {
            Id = channelId,
            Name = channelName,
            SampleRate = DefaultSampleRate,
            SampleCount = samples.Length,
            Quantity = "digital_amplitude",
            Unit = "FS",
            DbReference = new DbReference { Value = 1.0, Unit = "FS", DbUnit = "dBFS" },
            PhysicalMetadata = new SignalPhysicalMetadata { UnitKind = SignalUnitKind.DigitalFullScale },
            Samples = samples,
        };
    }
}
