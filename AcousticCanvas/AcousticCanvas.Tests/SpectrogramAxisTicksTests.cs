using AcousticCanvas.Features.Analysis.Analyzers;

namespace AcousticCanvas.Tests;

public sealed class SpectrogramAxisTicksTests
{
    [Fact]
    public void BuildTimeAxisTicks_ReturnsEvenlySpacedLabelsFromStartToEnd()
    {
        var ticks = SpectrogramAxisBuilder.BuildTimeAxisTicks(2.0, 7.0, 4);

        Assert.Equal(4, ticks.Count);
        Assert.Equal(0.0, ticks[0].PositionPercent, precision: 3);
        Assert.Equal("2.0s", ticks[0].Label);
        Assert.Equal(100.0, ticks[3].PositionPercent, precision: 3);
        Assert.Equal("7.0s", ticks[3].Label);
    }

    [Fact]
    public void BuildTimeAxisTicks_ReturnsSingleTickForZeroDuration()
    {
        var ticks = SpectrogramAxisBuilder.BuildTimeAxisTicks(4.0, 4.0, 6);

        Assert.Single(ticks);
        Assert.Equal(0.0, ticks[0].PositionPercent, precision: 3);
        Assert.Equal("4.0s", ticks[0].Label);
    }

    [Fact]
    public void BuildFrequencyAxisTicks_ZeroHzAtBottomNyquistAtTop()
    {
        var ticks = SpectrogramAxisBuilder.BuildFrequencyAxisTicks(8000.0, "linear", 6);

        // First tick (i=0, fraction=0) → lowest frequency → bottom of canvas (positionPercent ≈ 100)
        var bottomTick = ticks.OrderByDescending(t => t.PositionPercent).First();
        // Last tick (i=5, fraction=1) → nyquist → top of canvas (positionPercent ≈ 0)
        var topTick = ticks.OrderBy(t => t.PositionPercent).First();

        Assert.Equal("0 Hz", bottomTick.Label);
        Assert.Equal("8.0 kHz", topTick.Label);
    }

    [Fact]
    public void BuildFrequencyAxisTicks_UsesHzForSubKilohertzFrequencies()
    {
        var ticks = SpectrogramAxisBuilder.BuildFrequencyAxisTicks(500.0, "linear", 3);

        var topTick = ticks.OrderBy(t => t.PositionPercent).First();

        Assert.Contains("Hz", topTick.Label);
        Assert.DoesNotContain("kHz", topTick.Label);
    }

    [Fact]
    public void BuildTimeAxisTicks_MiddleTicksAreInterpolatedCorrectly()
    {
        var ticks = SpectrogramAxisBuilder.BuildTimeAxisTicks(0.0, 10.0, 3);

        Assert.Equal(3, ticks.Count);
        Assert.Equal(0.0, ticks[0].PositionPercent, precision: 3);
        Assert.Equal(50.0, ticks[1].PositionPercent, precision: 3);
        Assert.Equal(100.0, ticks[2].PositionPercent, precision: 3);
        Assert.Equal("5.0s", ticks[1].Label);
    }
}
