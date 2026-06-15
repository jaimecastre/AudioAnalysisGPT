using System.Text.Json;
using System.Text.Json.Serialization;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentBehaviorEvalTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [Theory]
    [MemberData(nameof(LoadEvalCases))]
    public void AgentBehaviorEvalCaseMatchesRoutingAndPromptContracts(
        AgentBehaviorEvalCase evalCase
    )
    {
        var deterministicPlan = DeterministicFactRouter.TryRoute(evalCase.Question);
        var noToolAnswer = AgentMetaQuestionRouter.TryAnswer(evalCase.Question);

        if (evalCase.ExpectedRoute == "deterministic_fact")
        {
            Assert.NotNull(deterministicPlan);
            Assert.Null(noToolAnswer);
            Assert.Equal(evalCase.ExpectedToolName, deterministicPlan!.ToolName);

            foreach (var expectedField in evalCase.ExpectedFields)
            {
                Assert.Contains(expectedField, deterministicPlan.RequestedFields);
            }
        }
        else if (evalCase.ExpectedRoute == "no_analysis_needed")
        {
            Assert.Null(deterministicPlan);
            Assert.NotNull(noToolAnswer);

            foreach (var expectedText in evalCase.NoToolAnswerMustContain)
            {
                Assert.Contains(expectedText, noToolAnswer!, StringComparison.OrdinalIgnoreCase);
            }
        }
        else if (evalCase.ExpectedRoute == "llm_plan")
        {
            Assert.Null(deterministicPlan);
            Assert.Null(noToolAnswer);

            var plannerPrompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
                AgentToolRegistry.BuildToolListSummaryForPrompt(),
                ["file-a", "file-b"],
                ["a.wav", "b.wav"]
            );

            foreach (var expectedText in evalCase.PlannerPromptMustContain)
            {
                Assert.Contains(expectedText, plannerPrompt, StringComparison.OrdinalIgnoreCase);
            }
        }
        else
        {
            throw new InvalidOperationException(
                $"Unknown expected route '{evalCase.ExpectedRoute}'."
            );
        }

        var finalPrompt = evalCase.FinalAnswerMustContainBlocks
            ? AgentPromptBuilder.BuildFinalAnswerSystemPromptWithBlocks()
            : AgentPromptBuilder.BuildFinalAnswerSystemPrompt();
        foreach (var expectedText in evalCase.FinalPromptMustContain)
        {
            Assert.Contains(expectedText, finalPrompt, StringComparison.OrdinalIgnoreCase);
        }
    }

    public static IEnumerable<object[]> LoadEvalCases()
    {
        var filePath = LocateEvalCaseFile();
        var lineNumber = 0;

        foreach (var line in File.ReadLines(filePath))
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var evalCase =
                JsonSerializer.Deserialize<AgentBehaviorEvalCase>(line, JsonOptions)
                ?? throw new InvalidOperationException(
                    $"Could not parse eval case at line {lineNumber}."
                );
            yield return [evalCase];
        }
    }

    private static string LocateEvalCaseFile()
    {
        var candidate = Path.Combine(
            AppContext.BaseDirectory,
            "AgentBehavior",
            "agent_eval_cases.jsonl"
        );
        if (File.Exists(candidate))
        {
            return candidate;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var fallback = Path.Combine(
                current.FullName,
                "AgentBehavior",
                "agent_eval_cases.jsonl"
            );
            if (File.Exists(fallback))
            {
                return fallback;
            }

            fallback = Path.Combine(
                current.FullName,
                "AcousticCanvas.Tests",
                "AgentBehavior",
                "agent_eval_cases.jsonl"
            );
            if (File.Exists(fallback))
            {
                return fallback;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException("Could not locate AgentBehavior/agent_eval_cases.jsonl.");
    }
}

public sealed record AgentBehaviorEvalCase
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("question")]
    public required string Question { get; init; }

    [JsonPropertyName("expectedRoute")]
    public required string ExpectedRoute { get; init; }

    [JsonPropertyName("expectedToolName")]
    public string? ExpectedToolName { get; init; }

    [JsonPropertyName("expectedFields")]
    public IReadOnlyList<string> ExpectedFields { get; init; } = [];

    [JsonPropertyName("plannerPromptMustContain")]
    public IReadOnlyList<string> PlannerPromptMustContain { get; init; } = [];

    [JsonPropertyName("finalPromptMustContain")]
    public IReadOnlyList<string> FinalPromptMustContain { get; init; } = [];

    [JsonPropertyName("noToolAnswerMustContain")]
    public IReadOnlyList<string> NoToolAnswerMustContain { get; init; } = [];

    [JsonPropertyName("finalAnswerMustContainBlocks")]
    public bool FinalAnswerMustContainBlocks { get; init; }
}
