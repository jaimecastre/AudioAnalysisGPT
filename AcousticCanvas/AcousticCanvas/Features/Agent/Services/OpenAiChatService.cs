using System.Text.Json;
using System.Text.Json.Serialization;
using AcousticCanvas.Features.Agent.Domain;

namespace AcousticCanvas.Features.Agent.Services;

public sealed class OpenAiChatService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly string _systemPrompt;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public OpenAiChatService(IConfiguration configuration)
    {
        // The key is resolved here but not required at construction time. Deterministic
        // fact answers never call the LLM, so the orchestrator must be able to start
        // even when no OpenAI key is configured. The key is enforced in CompleteAsync.
        _apiKey = configuration["OpenAI:ApiKey"]
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? string.Empty;
        _model = configuration["OpenAI:Model"] ?? "gpt-4o-mini";
        _systemPrompt = configuration["OpenAI:SystemPrompt"] ?? DefaultSystemPrompt;

        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("https://api.openai.com/"),
        };

        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");
        }
    }

    public async Task<ChatCompletionResponse> CompleteAsync(ChatCompletionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            throw new InvalidOperationException("OpenAI:ApiKey is not configured. Set it in appsettings.json, user secrets, or the OPENAI_API_KEY backend environment variable.");
        }

        var messages = EnsureSystemPrompt(request.Messages);

        var payload = new Dictionary<string, object?>
        {
            ["model"] = _model,
            ["messages"] = messages,
            ["temperature"] = request.Temperature ?? 0.2,
            ["max_tokens"] = request.MaxTokens ?? 1024,
        };

        if (request.Tools is { Count: > 0 })
        {
            payload["tools"] = request.Tools;
        }

        if (!string.IsNullOrEmpty(request.ToolChoice))
        {
            payload["tool_choice"] = request.ToolChoice;
        }

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("v1/chat/completions", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"OpenAI API returned {(int)response.StatusCode}: {errorBody}");
        }

        var responseJson = await response.Content.ReadAsStringAsync(ct);
        var result = JsonSerializer.Deserialize<ChatCompletionResponse>(responseJson, JsonOptions)
            ?? throw new InvalidOperationException("Failed to deserialize OpenAI response.");

        return result;
    }

    private List<ChatMessage> EnsureSystemPrompt(List<ChatMessage> messages)
    {
        if (messages.Count > 0 && messages[0].Role == "system")
        {
            return messages;
        }

        var withSystem = new List<ChatMessage>(messages.Count + 1)
        {
            new() { Role = "system", Content = _systemPrompt },
        };
        withSystem.AddRange(messages);
        return withSystem;
    }

    private const string DefaultSystemPrompt = """
        You are the AcousticCanvas Agent — a precise, technical audio analysis assistant.

        ## Role
        You help audio engineers, sound designers, and developers understand their audio files by running deterministic DSP analysis tools and explaining the measured results.

        ## Rules
        - Only make claims directly supported by tool results.
        - Use evidence-based phrasing: "Analysis shows…", "The measured peak is…"
        - Never invent frequencies, levels, metrics, or causes.
        - If evidence is insufficient, say so clearly.
        - Suggest one useful next analysis step when relevant.
        - Distinguish measured facts from derived conclusions.
        - Write in plain prose — no markdown, no asterisks, no headers.
        - Keep responses concise.
        """;
}
