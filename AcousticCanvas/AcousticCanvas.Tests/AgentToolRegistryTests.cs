using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentToolRegistryTests
{
    [Fact]
    public void ToolPromptSummaryIsGeneratedFromRegisteredToolMetadata()
    {
        var promptSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();

        foreach (var toolName in AgentToolRegistry.GetAllAllowedToolNames())
        {
            var definition = AgentToolRegistry.GetToolDefinition(toolName);

            Assert.NotNull(definition);
            Assert.False(string.IsNullOrWhiteSpace(definition!.PromptDescription));
            Assert.False(string.IsNullOrWhiteSpace(definition.ArgumentsPrompt));
            Assert.Contains($"- {toolName}: {definition.PromptDescription}", promptSummary);
            Assert.Contains($"  Arguments: {definition.ArgumentsPrompt}", promptSummary);
        }
    }
}
