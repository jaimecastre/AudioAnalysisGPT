using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests.AgentEvaluation;

public sealed class AgentAnswerEvalTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [Theory]
    [MemberData(nameof(LoadEvalCases))]
    public void AgentAnswerEvalCasePassesDeterministicGraders(AgentAnswerEvalCase evalCase)
    {
        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.True(result.Passed, string.Join("\n", result.Failures));
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
                JsonSerializer.Deserialize<AgentAnswerEvalCase>(line, JsonOptions)
                ?? throw new InvalidOperationException(
                    $"Could not parse answer eval case at line {lineNumber}."
                );
            yield return [evalCase];
        }
    }

    private static string LocateEvalCaseFile()
    {
        var candidate = Path.Combine(
            AppContext.BaseDirectory,
            "AgentEvaluation",
            "agent_answer_eval_cases.jsonl"
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
                "AcousticCanvas.Tests",
                "AgentEvaluation",
                "agent_answer_eval_cases.jsonl"
            );
            if (File.Exists(fallback))
            {
                return fallback;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException(
            "Could not locate AgentEvaluation/agent_answer_eval_cases.jsonl."
        );
    }
}
