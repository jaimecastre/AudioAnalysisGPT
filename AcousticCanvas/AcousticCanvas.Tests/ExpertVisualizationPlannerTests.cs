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
            Assert.False(
                string.IsNullOrWhiteSpace(block.Reason),
                $"Block '{block.BlockType}' has no reason."
            );
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
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "fileA",
                        ["resultId"] = "sp_a",
                    },
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
        Assert.All(
            trace.VisualizationPlan.Blocks,
            block => Assert.False(string.IsNullOrWhiteSpace(block.Reason))
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
    public void TwoSpectrumEvidenceItemsProduceSpectrumOverlayPlanBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare the two spectra.",
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
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file2",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file2",
                        ["fileName"] = "b.wav",
                        ["resultId"] = "spectrum_bbb",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var overlayBlock = plan.Blocks.FirstOrDefault(b => b.BlockType == "spectrumOverlay");
        Assert.NotNull(overlayBlock);
        Assert.NotNull(overlayBlock.SourceEvidenceIds);
        Assert.Equal(2, overlayBlock.SourceEvidenceIds.Count);
    }

    [Fact]
    public void SpectrumOverlaySuppressesIndividualSpectrumAnalysisViews()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare the two spectra.",
            selectedFileIds: ["file1", "file2"],
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
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file2",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file2",
                        ["fileName"] = "b.wav",
                        ["resultId"] = "spectrum_bbb",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.Single(plan.Blocks, block => block.BlockType == "spectrumOverlay");
        Assert.DoesNotContain(
            plan.Blocks,
            block => block.BlockType == "analysisView" && block.ViewType == "spectrum"
        );
    }

    [Fact]
    public void SingleSpectrumEvidenceItemDoesNotProduceSpectrumOverlayPlanBlock()
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
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, b => b.BlockType == "spectrumOverlay");
    }

    [Fact]
    public void BuildSpectrumOverlayBlocksBuildsSignalsWithCorrectResultIds()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare the spectra.",
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
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file2",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file2",
                        ["fileName"] = "b.wav",
                        ["resultId"] = "spectrum_bbb",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var overlays = AgentVisualizationBlockBuilder.BuildSpectrumOverlayBlocks(
            plan,
            evidencePackage
        );

        Assert.Single(overlays);
        Assert.Equal("Spectrum Comparison", overlays[0].Title);
        Assert.Equal(2, overlays[0].Signals.Count);
        Assert.Equal("spectrum_aaa", overlays[0].Signals[0].ResultId);
        Assert.Equal("a.wav", overlays[0].Signals[0].FileName);
        Assert.Equal("spectrum_bbb", overlays[0].Signals[1].ResultId);
        Assert.Equal("b.wav", overlays[0].Signals[1].FileName);
    }

    [Fact]
    public void MixedEvidenceTypesProduceInvestigationPlanBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Why does this sound harsh?",
            analysesRun: ["run_spectrum", "run_sound_quality"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_1",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "sq_aaa",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var investigationBlock = plan.Blocks.FirstOrDefault(b => b.BlockType == "investigation");
        Assert.NotNull(investigationBlock);
        Assert.NotNull(investigationBlock.SourceEvidenceIds);
        Assert.Equal(2, investigationBlock.SourceEvidenceIds.Count);
    }

    [Fact]
    public void SingleEvidenceTypeDoesNotProduceInvestigationPlanBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Show spectrum.",
            analysesRun: ["run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_2",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file2",
                        ["fileName"] = "b.wav",
                        ["resultId"] = "spectrum_bbb",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, b => b.BlockType == "investigation");
    }

    [Fact]
    public void BuildInvestigationBlocksBuildsCorrectSignalViewTypes()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Why does this sound harsh?",
            analysesRun: ["run_spectrum", "run_sound_quality"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_1",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "sq_aaa",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var investigations = AgentVisualizationBlockBuilder.BuildInvestigationBlocks(
            plan,
            evidencePackage
        );

        Assert.Single(investigations);
        Assert.Equal(2, investigations[0].Signals.Count);
        Assert.Equal("spectrum", investigations[0].Signals[0].ViewType);
        Assert.Equal("spectrum_aaa", investigations[0].Signals[0].ResultId);
        Assert.Equal("soundQuality", investigations[0].Signals[1].ViewType);
        Assert.Equal("sq_aaa", investigations[0].Signals[1].ResultId);
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

    [Fact]
    public void TwoSoundQualityEvidenceItemsProduceSoundQualityComparisonPlanBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare the sound quality of both files.",
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
                        ["fileName"] = "a.wav",
                        ["loudnessSone"] = 20.0,
                        ["sharpnessAcum"] = 1.5,
                        ["roughnessAsper"] = 0.02,
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_fileB",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "fileB",
                        ["fileName"] = "b.wav",
                        ["loudnessSone"] = 15.0,
                        ["sharpnessAcum"] = 1.7,
                        ["roughnessAsper"] = 0.03,
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        var comparisonBlock = plan.Blocks.FirstOrDefault(b =>
            b.BlockType == "soundQualityComparison"
        );
        Assert.NotNull(comparisonBlock);
        Assert.NotNull(comparisonBlock.SourceEvidenceIds);
        Assert.Equal(2, comparisonBlock.SourceEvidenceIds.Count);
        Assert.Contains("ev_sq_fileA", comparisonBlock.SourceEvidenceIds);
        Assert.Contains("ev_sq_fileB", comparisonBlock.SourceEvidenceIds);
    }

    [Fact]
    public void SoundQualityComparisonSuppressesIndividualSoundQualityAnalysisViews()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare the sound quality of both files.",
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
                        ["fileName"] = "a.wav",
                        ["loudnessSone"] = 20.0,
                        ["sharpnessAcum"] = 1.5,
                        ["roughnessAsper"] = 0.02,
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
                        ["fileName"] = "b.wav",
                        ["loudnessSone"] = 15.0,
                        ["sharpnessAcum"] = 1.7,
                        ["roughnessAsper"] = 0.03,
                        ["resultId"] = "sound_quality_b",
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.Single(plan.Blocks, block => block.BlockType == "soundQualityComparison");
        Assert.DoesNotContain(
            plan.Blocks,
            block => block.BlockType == "analysisView" && block.ViewType == "soundQuality"
        );
    }

    [Fact]
    public void SingleSoundQualityEvidenceItemDoesNotProduceSoundQualityComparisonPlanBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "What is the loudness of this file?",
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
                        ["fileName"] = "a.wav",
                        ["loudnessSone"] = 20.0,
                        ["sharpnessAcum"] = 1.5,
                        ["roughnessAsper"] = 0.02,
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);

        Assert.DoesNotContain(plan.Blocks, b => b.BlockType == "soundQualityComparison");
    }

    [Fact]
    public void BuildSoundQualityComparisonBlocksEmbedsMectricValues()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Compare sound quality.",
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
                        ["fileName"] = "a.wav",
                        ["loudnessSone"] = 20.0,
                        ["sharpnessAcum"] = 1.5,
                        ["roughnessAsper"] = 0.02,
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_fileB",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "fileB",
                        ["fileName"] = "b.wav",
                        ["loudnessSone"] = 15.0,
                        ["sharpnessAcum"] = 1.7,
                        ["roughnessAsper"] = 0.03,
                    },
                },
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var blocks = AgentVisualizationBlockBuilder.BuildSoundQualityComparisonBlocks(
            plan,
            evidencePackage
        );

        Assert.Single(blocks);
        Assert.Equal("Sound Quality Comparison", blocks[0].Title);
        Assert.Equal(2, blocks[0].Signals.Count);
        Assert.Equal("a.wav", blocks[0].Signals[0].FileName);
        Assert.Equal(20.0, blocks[0].Signals[0].LoudnessSone);
        Assert.Equal(1.5, blocks[0].Signals[0].SharpnessAcum);
        Assert.Equal(0.02, blocks[0].Signals[0].RoughnessAsper);
        Assert.Equal("b.wav", blocks[0].Signals[1].FileName);
        Assert.Equal(15.0, blocks[0].Signals[1].LoudnessSone);
    }

    [Fact]
    public void PlanForBroadMultiToolInvestigationIncludesWorkflowBlock()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Investigate this fan recording and generate a report.",
            analysesRun: ["get_metadata", "run_findings", "run_spectrum", "run_cpb"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_metadata_file1",
                    Type = "metadata",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_findings_file1",
                    Type = "findings",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "findings_abc",
                    },
                },
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

        Assert.Contains(
            plan.Blocks,
            block =>
                block.BlockType == "workflow"
                && block.SourceEvidenceIds is not null
                && block.SourceEvidenceIds.Count == 4
                && block.Reason.Contains("workflow", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void BuildWorkflowBlocksCreatesOrderedStepsFromEvidence()
    {
        var evidencePackage = BuildEvidencePackage(
            question: "Diagnose this fan recording.",
            analysesRun: ["get_metadata", "run_findings", "run_spectrum"],
            evidenceItems:
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_metadata_file1",
                    Type = "metadata",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_findings_file1",
                    Type = "findings",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file1",
                        ["fileName"] = "fan.wav",
                        ["resultId"] = "findings_abc",
                    },
                },
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
            ]
        );

        var plan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var blocks = AgentVisualizationBlockBuilder.BuildWorkflowBlocks(plan, evidencePackage);

        var block = Assert.Single(blocks);
        Assert.Equal("Generated analysis workflow", block.Title);
        Assert.Equal("Diagnose this fan recording.", block.Question);
        Assert.Equal(3, block.Steps.Count);
        Assert.Equal(1, block.Steps[0].StepNumber);
        Assert.Equal("get_metadata", block.Steps[0].ToolName);
        Assert.Equal("metadata", block.Steps[0].EvidenceType);
        Assert.Equal("fan.wav", block.Steps[0].FileName);
        Assert.Null(block.Steps[0].ResultId);
        Assert.Equal(2, block.Steps[1].StepNumber);
        Assert.Equal("run_findings", block.Steps[1].ToolName);
        Assert.Equal("findings_abc", block.Steps[1].ResultId);
        Assert.Equal(3, block.Steps[2].StepNumber);
        Assert.Equal("run_spectrum", block.Steps[2].ToolName);
        Assert.Equal("spectrum_abc", block.Steps[2].ResultId);
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
