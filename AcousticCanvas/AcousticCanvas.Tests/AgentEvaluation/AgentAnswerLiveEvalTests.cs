using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;
using AcousticCanvas.Features.Agent.Services;
using Microsoft.Extensions.Configuration;

namespace AcousticCanvas.Tests.AgentEvaluation;

public sealed class AgentAnswerLiveEvalTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [OptionalLiveOpenAiEvalFact]
    public async Task AgentAnswerLiveEvalCasesPassLocalGraders()
    {
        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["OpenAI:ApiKey"] = apiKey,
                    ["OpenAI:Model"] =
                        Environment.GetEnvironmentVariable("OPENAI_EVAL_MODEL") ?? "gpt-4o-mini",
                }
            )
            .Build();
        var openAiChatService = new OpenAiChatService(configuration);
        var agentPlanner = new AgentPlanner(openAiChatService);
        var failures = new List<string>();

        foreach (var evalCase in LoadEvalCases())
        {
            var liveAnswer = await agentPlanner.GenerateFinalAnswerAsync(
                evalCase.Question,
                evalCase.EvidencePackage,
                CancellationToken.None,
                Environment.GetEnvironmentVariable("OPENAI_EVAL_MODEL")
            );
            var liveEvalCase = evalCase with { FinalAnswer = liveAnswer };
            var result = AgentAnswerEvaluator.Evaluate(liveEvalCase);
            if (!result.Passed)
            {
                failures.Add($"{evalCase.Id}: {string.Join("; ", result.Failures)}");
            }
        }

        Assert.True(failures.Count == 0, string.Join("\n", failures));
    }

    private static IReadOnlyList<AgentAnswerEvalCase> LoadEvalCases()
    {
        var filePath = LocateEvalCaseFile();
        var evalCases = new List<AgentAnswerEvalCase>();

        foreach (var line in File.ReadLines(filePath))
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var evalCase =
                JsonSerializer.Deserialize<AgentAnswerEvalCase>(line, JsonOptions)
                ?? throw new InvalidOperationException("Could not parse answer eval case.");
            evalCases.Add(evalCase);
        }

        return evalCases;
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

public sealed class OptionalLiveOpenAiEvalFactAttribute : FactAttribute
{
    public OptionalLiveOpenAiEvalFactAttribute()
    {
        var liveEvalsEnabled = string.Equals(
            Environment.GetEnvironmentVariable("RUN_OPENAI_LIVE_EVALS"),
            "true",
            StringComparison.OrdinalIgnoreCase
        );
        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");

        if (!liveEvalsEnabled || string.IsNullOrWhiteSpace(apiKey))
        {
            Skip =
                "Set RUN_OPENAI_LIVE_EVALS=true and OPENAI_API_KEY to run live OpenAI answer evals.";
        }
    }
}
