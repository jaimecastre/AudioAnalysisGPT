using AcousticCanvas.Features.Agent.Commands;

namespace AcousticCanvas.Tests;

public sealed class AgentAskResultStreamOfThoughtTests
{
    [Fact]
    public void AgentAskResult_ContainsPlannedToolsAndPlannerReason()
    {
        var evidenceItem = new AgentEvidenceItem(
            EvidenceId: "ev_metrics_file_1",
            Type: "basic_metrics",
            Data: new Dictionary<string, object?>
            {
                ["peakDbFs"] = -3.2,
                ["rmsDbFs"] = -12.4,
            });

        var result = new AgentAskResult(
            ConversationId: "conv_abc12345",
            Answer: "The peak is -3.2 dBFS.",
            EvidencePackageId: "ev_abc12345",
            EvidenceReferences: ["ev_metrics_file_1"],
            EvidenceItems: [evidenceItem],
            Confidence: "high",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: ["run_basic_metrics", "run_spectrum"],
            PlannerReason: "Checking levels and spectral peaks.",
            InvestigationTrace: null,
            Blocks: null);

        Assert.Equal(["run_basic_metrics", "run_spectrum"], result.PlannedTools);
        Assert.Equal("Checking levels and spectral peaks.", result.PlannerReason);
        Assert.Equal(["ev_metrics_file_1"], result.EvidenceReferences);
        Assert.Single(result.EvidenceItems);
        Assert.Equal("basic_metrics", result.EvidenceItems[0].Type);
    }

    [Fact]
    public void AgentAskResult_AllowsNullPlannerReasonAndEmptyPlannedTools()
    {
        var result = new AgentAskResult(
            ConversationId: "conv_abc12345",
            Answer: "No tools were needed.",
            EvidencePackageId: "ev_abc12345",
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "low",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null,
            InvestigationTrace: null,
            Blocks: null);

        Assert.Empty(result.PlannedTools);
        Assert.Null(result.PlannerReason);
    }
}
