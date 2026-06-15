using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class ExpertVisualizationPlannerTests
{
    [Fact]
    public void PlanForSpectrumEvidencePrefersAnalysisView()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show me the spectrum for this file.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "spectrum_0123456789abcdef0123456789abcdef",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.Contains(
            plan.Blocks,
            block =>
                block.BlockType == "analysisView"
                && block.SourceEvidenceId == "ev_spectrum_file1"
                && block.ViewType == "spectrum"
        );
        Assert.Contains(
            plan.Blocks,
            block =>
                block.BlockType == "markdown"
                && block.Reason.Contains("summarize", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void PlanForMultiFileSoundQualityComparisonIncludesRanking()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Which of these files sounds harsher?",
            selectedFileIds: ["fileA", "fileB"],
            analysesRun: ["run_sound_quality_metrics"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_fileA",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "fileA",
                        ["fileName"] = "candidate-a.wav",
                        ["resultId"] = "sound_quality_a",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_fileB",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "fileB",
                        ["fileName"] = "candidate-b.wav",
                        ["resultId"] = "sound_quality_b",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.Contains(
            plan.Blocks,
            block =>
                block.BlockType == "ranking"
                && block.Reason.Contains("compare", StringComparison.OrdinalIgnoreCase)
        );
        Assert.Equal("sound_quality", plan.PrimaryEvidenceType);
    }

    [Fact]
    public void PlanForMethodQuestionWithoutEvidenceUsesMarkdownOnly()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "What is a spectrogram?",
            analysesRun: [],
            evidenceItems: []
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var block = Assert.Single(plan.Blocks);
        Assert.Equal("markdown", block.BlockType);
        Assert.Null(block.SourceEvidenceId);
        Assert.Equal("method_or_context_answer", plan.PrimaryEvidenceType);
    }

    [Fact]
    public void EachBlockHasNonEmptyReason()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show spectrum and run CPB.",
            analysesRun: ["run_spectrum", "run_cpb"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "spectrum_abc",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_cpb_file1",
                    Type = "cpb",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "cpb_abc",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        foreach (var block in plan.Blocks)
        {
            Assert.False(string.IsNullOrWhiteSpace(block.Reason),
                $"Block '{block.BlockType}' has no reason.");
        }
    }

    [Fact]
    public void EvidenceItemWithoutResultIdProducesNoAnalysisViewBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show the spectrum.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_no_result",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, block => block.BlockType == "analysisView");
    }

    [Fact]
    public void SingleFileComparisonQuestionDoesNotProduceRankingBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Which frequency range is loudest?",
            selectedFileIds: ["file1"],
            analysesRun: ["run_sound_quality_metrics"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_file1",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "sq_abc",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, block => block.BlockType == "ranking");
    }

    [Fact]
    public void MultiFileNonComparisonQuestionDoesNotProduceRankingBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show the spectrum for both files.",
            selectedFileIds: ["fileA", "fileB"],
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_fileA",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?> { ["fileId"] = "fileA", ["resultId"] = "sp_a" },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, block => block.BlockType == "ranking");
    }

    [Fact]
    public void BuildInvestigationTracePreservesVisualizationPlanBlockReasons()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Run spectrum analysis.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "signal.wav",
                        ["resultId"] = "spectrum_xyz",
                    },
                },
            ]
        );

        var visualizationPlan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var trace = AgentResultBuilder.BuildInvestigationTrace(
            conversationId: "conv_test",
            question: evidencePackage.UserQuestion,
            path: InvestigationPath.LlmPlanned,
            plannedTools: [],
            toolExecutions: [],
            finalAnswer: "Spectrum computed.",
            confidence: "high",
            visualizationPlan: visualizationPlan
        );

        Assert.NotNull(trace.VisualizationPlan);
        Assert.True(trace.VisualizationPlan!.Blocks.Count > 0);
        Assert.All(trace.VisualizationPlan.Blocks, block =>
            Assert.False(string.IsNullOrWhiteSpace(block.Reason))
        );
        var analysisViewBlock = Assert.Single(
            trace.VisualizationPlan.Blocks,
            block => block.BlockType == "analysisView"
        );
        Assert.Equal("spectrum", analysisViewBlock.ViewType);
        Assert.Equal("ev_spectrum_file1", analysisViewBlock.SourceEvidenceId);
    }

    [Fact]
    public void BuildInvestigationTraceWithNullVisualizationPlanLeavesTraceVisualizationPlanNull()
    {
        var trace = AgentResultBuilder.BuildInvestigationTrace(
            conversationId: "conv_test",
            question: "What is a spectrogram?",
            path: InvestigationPath.MetaQuestion,
            plannedTools: [],
            toolExecutions: [],
            finalAnswer: "A spectrogram plots frequency over time.",
            confidence: "high",
            visualizationPlan: null
        );

        Assert.Null(trace.VisualizationPlan);
    }

    [Fact]
    public void SpectrumEvidenceWithPeakFrequencyProducesPlotHintsOnAnalysisViewBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show the spectrum.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "tone.wav",
                        ["resultId"] = "spectrum_abc123",
                        ["peakFrequencyHz"] = 1000.0,
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var analysisViewBlock = plan.Blocks.FirstOrDefault(b => b.BlockType == "analysisView");
        Assert.NotNull(analysisViewBlock);
        Assert.NotNull(analysisViewBlock.PlotHints);
        Assert.Equal(1000.0, analysisViewBlock.PlotHints.FocusFrequencyHz);
        Assert.Equal(250.0, analysisViewBlock.PlotHints.FrequencyRangeMinHz);
        Assert.Equal(4000.0, analysisViewBlock.PlotHints.FrequencyRangeMaxHz);
        Assert.Equal("peak at 1 kHz", analysisViewBlock.PlotHints.AnnotationLabel);
    }

    [Fact]
    public void SpectrumEvidenceWithoutPeakFrequencyProducesNoPlotHints()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show the spectrum.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "tone.wav",
                        ["resultId"] = "spectrum_abc123",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var analysisViewBlock = plan.Blocks.FirstOrDefault(b => b.BlockType == "analysisView");
        Assert.NotNull(analysisViewBlock);
        Assert.Null(analysisViewBlock.PlotHints);
    }

    [Fact]
    public void BuildPlotHintsLookupMapsResultIdToHintsFromSpectrumEvidence()
    {
        const string resultId = "spectrum_abc123";
        var evidencePackage = BuildEvidencePackage(
            question: "Show the spectrum.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "tone.wav",
                        ["resultId"] = resultId,
                        ["peakFrequencyHz"] = 500.0,
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var lookup = AgentResultBuilder.BuildPlotHintsLookup(plan, evidencePackage);

        Assert.True(lookup.ContainsKey(resultId));
        Assert.Equal(500.0, lookup[resultId].FocusFrequencyHz);
        Assert.Equal(125.0, lookup[resultId].FrequencyRangeMinHz);
        Assert.Equal(2000.0, lookup[resultId].FrequencyRangeMaxHz);
        Assert.Equal("peak at 500 Hz", lookup[resultId].AnnotationLabel);
    }

    [Fact]
    public void BuildPlotHintsLookupReturnsEmptyWhenNoPlanBlocksHaveHints()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "What is the duration?",
            analysesRun: [],
            evidenceItems: []
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var lookup = AgentResultBuilder.BuildPlotHintsLookup(plan, evidencePackage);

        Assert.Empty(lookup);
    }

    private static EvidencePackage BuildEvidencePackage(
        string question,
        IReadOnlyList<string>? selectedFileIds = null,
        IReadOnlyList<string>? analysesRun = null,
        IReadOnlyList<EvidenceItem>? evidenceItems = null
    )
    {
        return new EvidencePackage
        {
            EvidencePackageId = "ev_pkg_test",
            UserQuestion = question,
            SelectedFileIds = selectedFileIds ?? ["file1"],
            AnalysesRun = analysesRun ?? [],
            KeyEvidence = evidenceItems ?? [],
            Limitations = [],
        };
    }
}
