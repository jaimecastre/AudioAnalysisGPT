using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

public sealed class MetricRankingTests
{
    [Fact]
    public void SoundQualityThresholds_AssessLoudness_Good()
    {
        var result = SoundQualityThresholds.AssessLoudness(65.0);
        Assert.Equal("Good", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessLoudness_Fair()
    {
        var result = SoundQualityThresholds.AssessLoudness(75.0);
        Assert.Equal("Fair", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessLoudness_Poor()
    {
        var result = SoundQualityThresholds.AssessLoudness(90.0);
        Assert.Equal("Poor", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessSharpness_Good()
    {
        var result = SoundQualityThresholds.AssessSharpness(1.5);
        Assert.Equal("Good", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessSharpness_Fair()
    {
        var result = SoundQualityThresholds.AssessSharpness(3.0);
        Assert.Equal("Fair", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessSharpness_Poor()
    {
        var result = SoundQualityThresholds.AssessSharpness(5.0);
        Assert.Equal("Poor", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessRoughness_Good()
    {
        var result = SoundQualityThresholds.AssessRoughness(0.3);
        Assert.Equal("Good", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessRoughness_Fair()
    {
        var result = SoundQualityThresholds.AssessRoughness(0.7);
        Assert.Equal("Fair", result);
    }

    [Fact]
    public void SoundQualityThresholds_AssessRoughness_Poor()
    {
        var result = SoundQualityThresholds.AssessRoughness(1.5);
        Assert.Equal("Poor", result);
    }

    [Fact]
    public void SoundQualityThresholds_Assess_Generic()
    {
        Assert.Equal("Good", SoundQualityThresholds.Assess(10.0, 15.0, 20.0));
        Assert.Equal("Fair", SoundQualityThresholds.Assess(17.0, 15.0, 20.0));
        Assert.Equal("Poor", SoundQualityThresholds.Assess(25.0, 15.0, 20.0));
    }
}
