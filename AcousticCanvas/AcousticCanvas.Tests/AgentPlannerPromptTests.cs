using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentPlannerPromptTests
{
    [Fact]
    public void PlannerUserMessageIncludesRecentConversationForTerseFollowUps()
    {
        var userMessage = AgentPlanner.BuildPlannerUserMessage(
            "spectrogram",
            ["file-a"],
            [
                new AgentConversationTurn("user", "and create a graph just for the important area"),
                new AgentConversationTurn(
                    "assistant",
                    "What specific important area are you referring to for the graph?"
                ),
                new AgentConversationTurn("user", "around 1000hz"),
            ]
        );

        Assert.Contains("Recent conversation:", userMessage);
        Assert.Contains("user: around 1000hz", userMessage);
        Assert.Contains("Current user question: spectrogram", userMessage);
        Assert.Contains("Selected file IDs: file-a", userMessage);
    }

    [Fact]
    public void PlannerSystemPromptTellsPlannerToResolveFrequencyFollowUpsFromContext()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a"],
            ["1000Hz_0.1.wav"]
        );

        Assert.Contains("Recent conversation", prompt);
        Assert.Contains("around 1000 hz", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("spectrogram", prompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void FinalAnswerPromptLimitsSpectrumPreviewArraysToSpectrumBlocks()
    {
        var prompt = AgentPromptBuilder.BuildFinalAnswerSystemPromptWithBlocks();

        Assert.Contains("For spectrum analysisView preview only", prompt);
        Assert.Contains("For non-spectrum analysisView blocks", prompt);
        Assert.Contains("spectrogram, cpb, soundQuality, findings", prompt);
        Assert.Contains("Do not add frequenciesHz or magnitudesDb", prompt);
    }
}
