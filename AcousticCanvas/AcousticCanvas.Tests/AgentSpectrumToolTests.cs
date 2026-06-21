using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentSpectrumToolTests
{
    [Fact]
    public void AgentToolRegistryIncludesRunSpectrum()
    {
        var definition = AgentToolRegistry.GetToolDefinition("run_spectrum");
        var promptSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();

        Assert.NotNull(definition);
        Assert.Contains("FFT spectrum", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_spectrum", promptSummary);
    }

    [Fact]
    public void PlannerPromptCoversSpectrumScenarios()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a", "file-b"],
            ["a.wav", "b.wav"]
        );

        Assert.Contains("what is the peak frequency", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("use the minimum tools needed", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "harshness or spectral questions",
            prompt,
            StringComparison.OrdinalIgnoreCase
        );
        Assert.Contains(
            "run_spectrum + run_cpb + run_sound_quality_metrics",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Add run_spectrum only when the user also asks for frequency peaks",
            prompt,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public void FinalAnswerPromptCoversSpectrumLimitations()
    {
        var prompt = AgentPromptBuilder.BuildFinalAnswerSystemPrompt();

        Assert.Contains(
            "peakFrequencyHz is just the single loudest FFT bin",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Do NOT cite peakFrequencyHz as a harshness proxy",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("If a metric was NOT measured", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "Do NOT invent specific gain corrections",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Spectrum can indicate whether energy exists at that frequency overall",
            prompt,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public void EvidencePackageBuilderExtractsSpectrumEvidence()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_spectrum",
            Status = "completed",
            ResultRef = "spectrum_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "file123456789",
                        summary = new
                        {
                            peakFrequencyHz = 257.0,
                            maxMagnitudeDb = -12.5,
                            dbUnit = "dB SPL",
                            dominantPeaks = new[]
                            {
                                new
                                {
                                    frequencyHz = 257.0,
                                    magnitudeDb = -12.5,
                                    prominenceDb = 10.0,
                                    confidence = "observed",
                                },
                            },
                        },
                        dataRef = "spectrum_abcdef12",
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "What is the peak frequency?",
            selectedFileIds: ["file123456789"],
            selectedFileNames: ["test_file.wav"],
            toolOutputs: [toolOutput]
        );

        Assert.Contains("run_spectrum", evidencePackage.AnalysesRun);
        var evidence = Assert.Single(evidencePackage.KeyEvidence, item => item.Type == "spectrum");
        Assert.Equal("ev_spectrum_file1234", evidence.EvidenceId);
        Assert.Equal("test_file.wav", evidence.Data["fileName"]);
        Assert.Equal(257.0, evidence.Data["peakFrequencyHz"]);
        Assert.Equal(-12.5, evidence.Data["maxMagnitudeDb"]);
        Assert.Equal("dB SPL", evidence.Data["spectrumDbUnit"]);
        Assert.Equal("spectrum_abcdef12", evidence.Data["dataRef"]);
        Assert.True(evidence.Data.ContainsKey("dominantPeaks"));
    }

    [Fact]
    public void EvidencePackageBuilderEmitsSpectrumComparisonEvidenceForTwoFiles()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_spectrum",
            Status = "completed",
            ResultRef = "spectrum_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "fileA123456",
                        summary = new
                        {
                            peakFrequencyHz = 257.0,
                            maxMagnitudeDb = -12.5,
                            dominantPeaks = Array.Empty<object>(),
                        },
                    },
                    new
                    {
                        fileId = "fileB123456",
                        summary = new
                        {
                            peakFrequencyHz = 86.0,
                            maxMagnitudeDb = -18.25,
                            dominantPeaks = Array.Empty<object>(),
                        },
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "Compare the spectra.",
            selectedFileIds: ["fileA123456", "fileB123456"],
            selectedFileNames: ["a.wav", "b.wav"],
            toolOutputs: [toolOutput]
        );

        Assert.Contains("run_spectrum", evidencePackage.AnalysesRun);
        Assert.Equal(2, evidencePackage.KeyEvidence.Count(item => item.Type == "spectrum"));
        var comparison = Assert.Single(
            evidencePackage.KeyEvidence,
            item => item.Type == "spectrum_comparison"
        );
        Assert.Equal("a.wav", comparison.Data["fileNameA"]);
        Assert.Equal("b.wav", comparison.Data["fileNameB"]);
        Assert.Equal(257.0, comparison.Data["peakFrequencyAHz"]);
        Assert.Equal(86.0, comparison.Data["peakFrequencyBHz"]);
        Assert.Equal(-171.0, comparison.Data["peakFrequencyDeltaHz"]);
        Assert.Equal(-5.75, comparison.Data["maxMagnitudeDeltaDb"]);
    }
}
