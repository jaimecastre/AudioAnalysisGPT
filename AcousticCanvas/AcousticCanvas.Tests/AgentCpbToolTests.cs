using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentCpbToolTests
{
    [Fact]
    public void AgentToolRegistryIncludesRunCpb()
    {
        var definition = AgentToolRegistry.GetToolDefinition("run_cpb");
        var promptSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();

        Assert.NotNull(definition);
        Assert.Contains("octave", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_cpb", promptSummary);
    }

    [Fact]
    public void PlannerPromptCoversCpbScenarios()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a", "file-b"],
            ["a.wav", "b.wav"]
        );

        Assert.Contains(
            "harshness or spectral questions",
            prompt,
            StringComparison.OrdinalIgnoreCase
        );
        Assert.Contains("CPB, octave-band, 1/3-octave", prompt, StringComparison.Ordinal);
        Assert.Contains("run_cpb on each file", prompt, StringComparison.Ordinal);
        Assert.Contains("which-band-is-strongest", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "run_spectrum + run_cpb + run_sound_quality_metrics",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("general/open-ended questions", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_cpb", prompt, StringComparison.Ordinal);
        Assert.Contains("what does CPB mean?", prompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void FinalAnswerPromptCoversCpbLimitations()
    {
        var prompt = AgentPromptBuilder.BuildFinalAnswerSystemPrompt();

        Assert.Contains("BAND ENERGIES", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "Tinny = excess presence/high band energy",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("Muddy = excess low_mid", prompt, StringComparison.Ordinal);
        Assert.Contains("Boomy = excess sub/low", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "CPB evidence is band-level frequency-balance evidence",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("Do NOT claim IEC 61260 compliance", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "Do NOT use CPB as proof of an exact tonal peak frequency",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Do NOT invent specific gain corrections",
            prompt,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public void EvidencePackageBuilderExtractsCpbEvidenceAndLimitation()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_cpb",
            Status = "completed",
            ResultRef = "cpb_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "file123456789",
                        bandMode = "third_octave",
                        weighting = "Z",
                        weightingMethod = "none",
                        method = "fft_bin_power_sum (nominal approximation, not IEC 61260)",
                        summary = new
                        {
                            highestBands = new[]
                            {
                                new
                                {
                                    centerFrequencyHz = 1000.0,
                                    levelDb = -12.5,
                                    label = "1k",
                                },
                            },
                        },
                        dataRef = "cpb_abcdef12",
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "Show CPB bands.",
            selectedFileIds: ["file123456789"],
            selectedFileNames: ["test_file.wav"],
            toolOutputs: [toolOutput]
        );

        Assert.Contains("run_cpb", evidencePackage.AnalysesRun);
        var evidence = Assert.Single(evidencePackage.KeyEvidence, item => item.Type == "cpb");
        Assert.Equal("ev_cpb_file1234", evidence.EvidenceId);
        Assert.Equal("test_file.wav", evidence.Data["fileName"]);
        Assert.Equal("third_octave", evidence.Data["bandMode"]);
        Assert.Equal(
            "fft_bin_power_sum (nominal approximation, not IEC 61260)",
            evidence.Data["method"]
        );
        Assert.Equal("cpb_abcdef12", evidence.Data["dataRef"]);
        Assert.True(evidence.Data.ContainsKey("highestBands"));
        Assert.Contains(
            evidencePackage.Limitations,
            limitation => limitation.Contains("not IEC 61260", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void EvidencePackageBuilderExtractsCpbEvidenceForMultipleFiles()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_cpb",
            Status = "completed",
            ResultRef = "cpb_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "fileA123456",
                        bandMode = "third_octave",
                        method = "fft_bin_power_sum (nominal approximation, not IEC 61260)",
                        summary = new
                        {
                            highestBands = new[]
                            {
                                new
                                {
                                    centerFrequencyHz = 1000.0,
                                    levelDb = -12.5,
                                    label = "1k",
                                },
                            },
                        },
                    },
                    new
                    {
                        fileId = "fileB123456",
                        bandMode = "third_octave",
                        method = "fft_bin_power_sum (nominal approximation, not IEC 61260)",
                        summary = new
                        {
                            highestBands = new[]
                            {
                                new
                                {
                                    centerFrequencyHz = 500.0,
                                    levelDb = -18.25,
                                    label = "500",
                                },
                            },
                        },
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "Run CPB for all files.",
            selectedFileIds: ["fileA123456", "fileB123456"],
            selectedFileNames: ["a.wav", "b.wav"],
            toolOutputs: [toolOutput]
        );

        var evidenceItems = evidencePackage.KeyEvidence.Where(item => item.Type == "cpb").ToArray();

        Assert.Equal(2, evidenceItems.Length);
        Assert.Contains(evidenceItems, item => Equals(item.Data["fileName"], "a.wav"));
        Assert.Contains(evidenceItems, item => Equals(item.Data["fileName"], "b.wav"));
    }
}
