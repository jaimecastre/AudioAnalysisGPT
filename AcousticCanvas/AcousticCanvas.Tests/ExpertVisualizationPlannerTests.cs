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
