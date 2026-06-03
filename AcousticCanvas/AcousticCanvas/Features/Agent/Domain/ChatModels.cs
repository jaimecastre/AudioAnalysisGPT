using System.Text.Json.Serialization;

namespace AcousticCanvas.Features.Agent.Domain;

public sealed class ChatCompletionRequest
{
    [JsonPropertyName("messages")]
    public required List<ChatMessage> Messages { get; init; }

    [JsonPropertyName("tools")]
    public List<ToolSchema>? Tools { get; init; }

    [JsonPropertyName("tool_choice")]
    public string? ToolChoice { get; init; }

    [JsonPropertyName("temperature")]
    public double? Temperature { get; init; }

    [JsonPropertyName("max_tokens")]
    public int? MaxTokens { get; init; }
}

public sealed class ChatMessage
{
    [JsonPropertyName("role")]
    public required string Role { get; init; }

    [JsonPropertyName("content")]
    public string? Content { get; init; }

    [JsonPropertyName("tool_calls")]
    public List<ToolCall>? ToolCalls { get; init; }

    [JsonPropertyName("tool_call_id")]
    public string? ToolCallId { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }
}

public sealed class ToolCall
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("type")]
    public string Type { get; init; } = "function";

    [JsonPropertyName("function")]
    public required ToolCallFunction Function { get; init; }
}

public sealed class ToolCallFunction
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("arguments")]
    public required string Arguments { get; init; }
}

public sealed class ToolSchema
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "function";

    [JsonPropertyName("function")]
    public required ToolSchemaFunction Function { get; init; }
}

public sealed class ToolSchemaFunction
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("description")]
    public required string Description { get; init; }

    [JsonPropertyName("parameters")]
    public required Dictionary<string, object> Parameters { get; init; }

    [JsonPropertyName("strict")]
    public bool? Strict { get; init; }
}

public sealed class ChatCompletionResponse
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("choices")]
    public required List<ChatChoice> Choices { get; init; }

    [JsonPropertyName("usage")]
    public required ChatUsage Usage { get; init; }
}

public sealed class ChatChoice
{
    [JsonPropertyName("message")]
    public required ChatChoiceMessage Message { get; init; }

    [JsonPropertyName("finish_reason")]
    public required string FinishReason { get; init; }
}

public sealed class ChatChoiceMessage
{
    [JsonPropertyName("role")]
    public required string Role { get; init; }

    [JsonPropertyName("content")]
    public string? Content { get; init; }

    [JsonPropertyName("tool_calls")]
    public List<ToolCall>? ToolCalls { get; init; }
}

public sealed class ChatUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; init; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; init; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; init; }
}
