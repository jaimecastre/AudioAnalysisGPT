using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

/// <summary>
/// Tests EvidencePackageBuilder: package construction, failure handling,
/// limitations, file name mapping, and evidence extraction routing.
/// </summary>
public sealed class EvidencePackageBuilderTests
{
    [Fact]
    public void EmptyToolOutputsProducesEmptyEvidence()
    {
        var package = EvidencePackageBuilder.Build(
            "what is the peak level?",
            ["file-1"],
            ["test.wav"],
            []
        );

        Assert.Empty(package.AnalysesRun);
        Assert.Empty(package.KeyEvidence);
        Assert.StartsWith("ev_", package.EvidencePackageId);
        Assert.Equal("what is the peak level?", package.UserQuestion);
    }

    [Fact]
    public void FailedToolAddsLimitationNotEvidence()
    {
        var failedOutput = ToolOutputBuilder.BuildFailureOutput(
            "run_basic_metrics",
            "FILE_NOT_FOUND",
            "File not found."
        );

        var package = EvidencePackageBuilder.Build(
            "analyze this",
            ["file-1"],
            ["test.wav"],
            [failedOutput]
        );

        Assert.Empty(package.AnalysesRun);
        Assert.Empty(package.KeyEvidence);
        Assert.Contains(package.Limitations, l => l.Contains("run_basic_metrics"));
        Assert.Contains(package.Limitations, l => l.Contains("File not found"));
    }

    [Fact]
    public void CompletedBasicMetricsProducesEvidenceItem()
    {
        var toolOutput = BuildBasicMetricsOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "what is the peak?",
            ["file-1"],
            ["test.wav"],
            [toolOutput]
        );

        Assert.Contains("run_basic_metrics", package.AnalysesRun);
        Assert.NotEmpty(package.KeyEvidence);
        Assert.Contains(package.KeyEvidence, e => e.Type == "basic_metrics");
    }

    [Fact]
    public void CompletedBasicMetricsUsesNeutralDbKeysAndPreservesUnit()
    {
        var toolOutput = BuildBasicMetricsOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "diagnose this recording",
            ["file-1"],
            ["test.wav"],
            [toolOutput]
        );

        var metrics = Assert.Single(package.KeyEvidence, e => e.Type == "basic_metrics");
        Assert.Equal(69.1, metrics.Data["rmsDb"]);
        Assert.Equal(83.9, metrics.Data["peakDb"]);
        Assert.Equal("dB SPL", metrics.Data["levelDbUnit"]);
        Assert.False(metrics.Data.ContainsKey("rmsDbFs"));
        Assert.False(metrics.Data.ContainsKey("peakDbFs"));
    }

    [Fact]
    public void CompletedEventDetectionProducesEvidenceItem()
    {
        var toolOutput = BuildEventDetectionOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "is there clipping?",
            ["file-1"],
            ["test.wav"],
            [toolOutput]
        );

        Assert.Contains("run_event_detection", package.AnalysesRun);
        Assert.NotEmpty(package.KeyEvidence);
        Assert.Contains(package.KeyEvidence, e => e.Type == "event_detection");
    }

    [Fact]
    public void BasicMetricsAddsAnalogDistortionLimitation()
    {
        var toolOutput = BuildBasicMetricsOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "analyze",
            ["file-1"],
            ["test.wav"],
            [toolOutput]
        );

        Assert.Contains(
            package.Limitations,
            l => l.Contains("Analog distortion", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void CpbToolAddsCpbLimitation()
    {
        var toolOutput = BuildCpbOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "show cpb",
            ["file-1"],
            ["test.wav"],
            [toolOutput]
        );

        Assert.Contains(
            package.Limitations,
            l => l.Contains("IEC 61260", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void MultipleToolOutputsProduceMultipleEvidenceItems()
    {
        var metricsOutput = BuildBasicMetricsOutput("file-1");
        var eventOutput = BuildEventDetectionOutput("file-1");

        var package = EvidencePackageBuilder.Build(
            "full analysis",
            ["file-1"],
            ["test.wav"],
            [metricsOutput, eventOutput]
        );

        Assert.Equal(2, package.AnalysesRun.Count);
        Assert.True(package.KeyEvidence.Count >= 2);
    }

    [Fact]
    public void MixedCompletedAndFailedToolsAreHandledCorrectly()
    {
        var successOutput = BuildBasicMetricsOutput("file-1");
        var failedOutput = ToolOutputBuilder.BuildFailureOutput(
            "run_spectrum",
            "TIMEOUT",
            "Timed out."
        );

        var package = EvidencePackageBuilder.Build(
            "analyze",
            ["file-1"],
            ["test.wav"],
            [successOutput, failedOutput]
        );

        Assert.Single(package.AnalysesRun);
        Assert.Equal("run_basic_metrics", package.AnalysesRun[0]);
        Assert.Contains(package.Limitations, l => l.Contains("run_spectrum"));
    }

    [Fact]
    public void SelectedFileIdsArePreserved()
    {
        var package = EvidencePackageBuilder.Build(
            "compare",
            ["file-a", "file-b"],
            ["a.wav", "b.wav"],
            []
        );

        Assert.Equal(2, package.SelectedFileIds.Count);
        Assert.Equal("file-a", package.SelectedFileIds[0]);
        Assert.Equal("file-b", package.SelectedFileIds[1]);
    }

    [Fact]
    public void EvidencePackageIdIsUnique()
    {
        var pkg1 = EvidencePackageBuilder.Build("q1", [], [], []);
        var pkg2 = EvidencePackageBuilder.Build("q2", [], [], []);

        Assert.NotEqual(pkg1.EvidencePackageId, pkg2.EvidencePackageId);
    }

    // =================================================================
    // Helpers — build realistic tool outputs
    // =================================================================

    private static ToolExecutionOutput BuildBasicMetricsOutput(string fileId)
    {
        var resultData = new
        {
            results = new[]
            {
                new
                {
                    fileId,
                    metrics = new
                    {
                        rmsDb = 69.1,
                        peakDb = 83.9,
                        crestFactorDb = 17.2,
                        dcOffsetLinear = 0.001,
                        dbUnit = "dB SPL",
                    },
                },
            },
        };

        return ToolOutputBuilder.BuildSuccessOutput(
            "run_basic_metrics",
            "basic_metrics_abc12345",
            resultData
        );
    }

    private static ToolExecutionOutput BuildEventDetectionOutput(string fileId)
    {
        var resultData = new
        {
            fileId,
            kind = "clipping",
            eventCount = 1,
            events = new[]
            {
                new
                {
                    startSeconds = 0.5,
                    endSeconds = 0.51,
                    durationSeconds = 0.01,
                    description = "Clipping detected",
                },
            },
        };

        return ToolOutputBuilder.BuildSuccessOutput(
            "run_event_detection",
            "events_abc12345",
            resultData
        );
    }

    private static ToolExecutionOutput BuildCpbOutput(string fileId)
    {
        var resultData = new
        {
            results = new[]
            {
                new
                {
                    fileId,
                    bandMode = "third_octave",
                    summary = new
                    {
                        highestBands = new[]
                        {
                            new
                            {
                                centerFrequencyHz = 1000.0,
                                levelDb = -20.0,
                                label = "1 kHz",
                            },
                        },
                    },
                },
            },
        };

        return ToolOutputBuilder.BuildSuccessOutput("run_cpb", "cpb_abc12345", resultData);
    }
}
