using AcousticCanvas.Features.Agent.Commands;

namespace AcousticCanvas.Tests;

public sealed class AgentAskResultStreamOfThoughtTests
{
    [Fact]
    public void AgentAskResult_ContainsPlannedToolsAndPlannerReason()
    {
        var result = new AgentAskResult(
            ConversationId: "conv_abc12345",
            Answer: "The peak is -3.2 dBFS.",
            EvidencePackageId: "ev_abc12345",
            EvidenceReferences: [],
            Confidence: "high",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: ["run_basic_metrics", "run_spectrum"],
            PlannerReason: "Checking levels and spectral peaks.");

        Assert.Equal(["run_basic_metrics", "run_spectrum"], result.PlannedTools);
        Assert.Equal("Checking levels and spectral peaks.", result.PlannerReason);
    }

    [Fact]
    public void AgentAskResult_AllowsNullPlannerReasonAndEmptyPlannedTools()
    {
        var result = new AgentAskResult(
            ConversationId: "conv_abc12345",
            Answer: "No tools were needed.",
            EvidencePackageId: "ev_abc12345",
            EvidenceReferences: [],
            Confidence: "low",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null);

        Assert.Empty(result.PlannedTools);
        Assert.Null(result.PlannerReason);
    }
}
