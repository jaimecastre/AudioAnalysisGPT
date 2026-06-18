using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class DeterministicVisualRouterTests
{
    [Fact]
    public void RoutesGenericGraphRequestToVisualTools()
    {
        var plan = DeterministicVisualRouter.TryRoute("show me some graphs");

        Assert.NotNull(plan);
        Assert.Equal(["run_spectrum", "run_spectrogram"], plan!.ToolNames);
    }

    [Fact]
    public void RoutesPlotRequestToVisualTools()
    {
        var plan = DeterministicVisualRouter.TryRoute("plot the loaded files");

        Assert.NotNull(plan);
        Assert.Equal(["run_spectrum", "run_spectrogram"], plan!.ToolNames);
    }

    [Fact]
    public void RoutesSpectraComparisonRequestToSpectrumOnly()
    {
        var plan = DeterministicVisualRouter.TryRoute("compare the spectra of the loaded files");

        Assert.NotNull(plan);
        Assert.Equal(["run_spectrum"], plan!.ToolNames);
    }

    [Fact]
    public void RoutesBroadFileComparisonRequestToFullComparisonSuite()
    {
        var plan = DeterministicVisualRouter.TryRoute("compare the files");

        Assert.NotNull(plan);
        Assert.Equal(
            [
                "get_metadata",
                "run_basic_metrics",
                "run_spectrum",
                "run_cpb",
                "run_sound_quality_metrics",
                "run_event_detection",
            ],
            plan!.ToolNames
        );
    }

    [Fact]
    public void DoesNotRouteSpectrogramComparisonAsSpectrum()
    {
        var plan = DeterministicVisualRouter.TryRoute("compare the spectrograms");

        Assert.Null(plan);
    }

    [Fact]
    public void DoesNotRouteMethodDefinitionQuestion()
    {
        var plan = DeterministicVisualRouter.TryRoute("what is a graph?");

        Assert.Null(plan);
    }
}
