using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class DeterministicFactRouterTests
{
    [Fact]
    public void RoutesPeakLevelQuestionToBasicMetrics()
    {
        var plan = DeterministicFactRouter.TryRoute("What is the peak level?");

        Assert.NotNull(plan);
        Assert.Equal("run_basic_metrics", plan!.ToolName);
        Assert.Contains("peak", plan.RequestedFields);
    }

    [Fact]
    public void RoutesRmsQuestionToBasicMetrics()
    {
        var plan = DeterministicFactRouter.TryRoute("what's the RMS level of this file");

        Assert.NotNull(plan);
        Assert.Equal("run_basic_metrics", plan!.ToolName);
        Assert.Contains("rms", plan.RequestedFields);
    }

    [Fact]
    public void RoutesCrestFactorQuestionToBasicMetrics()
    {
        var plan = DeterministicFactRouter.TryRoute("what is the crest factor");

        Assert.NotNull(plan);
        Assert.Equal("run_basic_metrics", plan!.ToolName);
        Assert.Contains("crest", plan.RequestedFields);
    }

    [Fact]
    public void RoutesSampleRateQuestionToMetadata()
    {
        var plan = DeterministicFactRouter.TryRoute("What's the sample rate?");

        Assert.NotNull(plan);
        Assert.Equal("get_metadata", plan!.ToolName);
        Assert.Contains("sampleRate", plan.RequestedFields);
    }

    [Fact]
    public void RoutesDurationQuestionToMetadata()
    {
        var plan = DeterministicFactRouter.TryRoute("how long is the file?");

        Assert.NotNull(plan);
        Assert.Equal("get_metadata", plan!.ToolName);
        Assert.Contains("duration", plan.RequestedFields);
    }

    [Fact]
    public void RoutesChannelCountQuestionToMetadata()
    {
        var plan = DeterministicFactRouter.TryRoute("how many channels does it have");

        Assert.NotNull(plan);
        Assert.Equal("get_metadata", plan!.ToolName);
        Assert.Contains("channels", plan.RequestedFields);
    }

    [Fact]
    public void RoutesBitDepthQuestionToMetadata()
    {
        var plan = DeterministicFactRouter.TryRoute("what bit depth is this");

        Assert.NotNull(plan);
        Assert.Equal("get_metadata", plan!.ToolName);
        Assert.Contains("bitDepth", plan.RequestedFields);
    }

    [Fact]
    public void RoutesFileFormatQuestionToFullMetadataSummary()
    {
        var plan = DeterministicFactRouter.TryRoute("what is the file format?");

        Assert.NotNull(plan);
        Assert.Equal("get_metadata", plan!.ToolName);
        Assert.Contains("sampleRate", plan.RequestedFields);
        Assert.Contains("bitDepth", plan.RequestedFields);
        Assert.Contains("channels", plan.RequestedFields);
    }

    [Fact]
    public void CombinesMultipleBasicMetricFieldsForOneTool()
    {
        var plan = DeterministicFactRouter.TryRoute("show me the peak and rms levels");

        Assert.NotNull(plan);
        Assert.Equal("run_basic_metrics", plan!.ToolName);
        Assert.Contains("peak", plan.RequestedFields);
        Assert.Contains("rms", plan.RequestedFields);
    }

    [Fact]
    public void DoesNotRouteInterpretiveLoudnessQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("is this file too loud?");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRouteWhyQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("why does the peak level sound harsh?");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRoutePeakFrequencySpectralQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("what is the peak frequency in the spectrum?");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRouteComparisonQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("compare the peak level of A vs B");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRouteMixedMetricAndMetadataQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("what is the peak level and the sample rate?");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRouteEmptyQuestion()
    {
        var plan = DeterministicFactRouter.TryRoute("   ");

        Assert.Null(plan);
    }
}
