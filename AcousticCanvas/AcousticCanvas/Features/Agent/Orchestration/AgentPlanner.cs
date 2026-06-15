using System.Text;
using System.Text.Json;
using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Domain;
using AcousticCanvas.Features.Agent.Services;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentPlanner(OpenAiChatService openAiChatService)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<PlannerResponse> PlanRequiredToolsAsync(
        string userQuestion,
        IReadOnlyList<string> selectedFileIds,
        IReadOnlyList<string> selectedFileNames,
        IReadOnlyList<AgentConversationTurn> conversationContext,
        CancellationToken cancellationToken,
        string? modelOverride = null
    )
    {
        var availableToolsSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();
        var systemPrompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            availableToolsSummary,
            selectedFileIds,
            selectedFileNames
        );

        var userMessageContent = BuildPlannerUserMessage(
            userQuestion,
            selectedFileIds,
            conversationContext
        );

        var plannerRequest = new ChatCompletionRequest
        {
            Messages =
            [
                new ChatMessage { Role = "system", Content = systemPrompt },
                new ChatMessage { Role = "user", Content = userMessageContent },
            ],
            Temperature = 0.0,
            MaxTokens = 512,
        };

        var openAiResponse = await openAiChatService.CompleteAsync(
            plannerRequest,
            cancellationToken,
            modelOverride
        );

        var rawContent = openAiResponse.Choices[0].Message.Content ?? string.Empty;
        var cleanedContent = StripMarkdownCodeFences(rawContent);

        PlannerResponse? plannerResponse;
        try
        {
            plannerResponse = JsonSerializer.Deserialize<PlannerResponse>(
                cleanedContent,
                JsonOptions
            );
        }
        catch (JsonException)
        {
            plannerResponse = null;
        }

        if (plannerResponse is null || string.IsNullOrWhiteSpace(plannerResponse.Action))
        {
            return new PlannerResponse
            {
                Action = "no_analysis_needed",
                Reason = "Planner returned an unparseable response. Falling back to no-tool mode.",
            };
        }

        return plannerResponse;
    }

    public async Task<FinalAnswerResponse> GenerateFinalAnswerAsync(
        string userQuestion,
        EvidencePackage evidencePackage,
        CancellationToken cancellationToken,
        string? modelOverride = null
    )
    {
        var systemPrompt = AgentPromptBuilder.BuildFinalAnswerSystemPromptWithBlocks();

        var evidenceJson = JsonSerializer.Serialize(
            evidencePackage,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false,
            }
        );

        var userMessageContent = $"""
            User question: {userQuestion}

            Evidence package:
            {evidenceJson}

            Explain the evidence clearly. Put evidenceId values only in the evidenceReferences array — never in the answer text. Do not write an "Evidence:" section. Return valid JSON only.
            """;

        var answerRequest = new ChatCompletionRequest
        {
            Messages =
            [
                new ChatMessage { Role = "system", Content = systemPrompt },
                new ChatMessage { Role = "user", Content = userMessageContent },
            ],
            Temperature = 0.2,
            MaxTokens = 8192,
        };

        var openAiResponse = await openAiChatService.CompleteAsync(
            answerRequest,
            cancellationToken,
            modelOverride
        );

        var rawContent = openAiResponse.Choices[0].Message.Content ?? string.Empty;
        var cleanedContent = StripMarkdownCodeFences(rawContent);

        FinalAnswerResponse? finalAnswer;
        Exception? parseError = null;
        try
        {
            finalAnswer = JsonSerializer.Deserialize<FinalAnswerResponse>(
                cleanedContent,
                JsonOptions
            );
        }
        catch (JsonException ex)
        {
            parseError = ex;
            finalAnswer = null;
        }

        if (finalAnswer is null)
        {
            // Try to extract just the answer text from the malformed JSON
            var extractedAnswer = ExtractAnswerFromMalformedJson(cleanedContent) ?? rawContent;

            return new FinalAnswerResponse
            {
                Answer =
                    extractedAnswer.Length > 0
                        ? extractedAnswer
                        : "Analysis complete. Please review the evidence package for details.",
                EvidenceReferences = [],
                Confidence = "low",
                Limitations = [$"Agent response could not be parsed: {parseError?.Message}"],
                SuggestedNextSteps = [],
            };
        }

        return finalAnswer;
    }

    private static string? ExtractAnswerFromMalformedJson(string content)
    {
        try
        {
            // Try to parse as loose JSON to extract just the answer field
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("answer", out var answerEl))
            {
                return answerEl.GetString();
            }
        }
        catch
        {
            // Ignore - we'll return null and use raw content
        }
        return null;
    }

    public static string BuildPlannerUserMessage(
        string userQuestion,
        IReadOnlyList<string> selectedFileIds,
        IReadOnlyList<AgentConversationTurn> conversationContext
    )
    {
        var fileIdsText = selectedFileIds.Count > 0 ? string.Join(", ", selectedFileIds) : "none";

        var contextBuilder = new StringBuilder();
        if (conversationContext.Count > 0)
        {
            contextBuilder.AppendLine("Recent conversation:");
            foreach (var turn in conversationContext)
            {
                var role = turn.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase)
                    ? "assistant"
                    : "user";
                var content = turn.Content.ReplaceLineEndings(" ").Trim();
                if (content.Length == 0)
                {
                    continue;
                }
                contextBuilder.AppendLine($"{role}: {content}");
            }
            contextBuilder.AppendLine();
        }

        contextBuilder.AppendLine($"Current user question: {userQuestion}");
        contextBuilder.AppendLine();
        contextBuilder.Append($"Selected file IDs: {fileIdsText}");

        return contextBuilder.ToString();
    }

    private static string StripMarkdownCodeFences(string raw)
    {
        var trimmed = raw.Trim();

        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..];
        }
        else if (trimmed.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[3..];
        }

        if (trimmed.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[..^3];
        }

        return trimmed.Trim();
    }
}
