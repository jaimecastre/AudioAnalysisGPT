namespace AcousticCanvas.Features.Agent.Domain;

public sealed class ChatCompletionRequest
{
    public required List<ChatMessage> Messages { get; init; }
    public List<ToolSchema>? Tools { get; init; }
    public string? ToolChoice { get; init; }
    public double? Temperature { get; init; }
    public int? MaxTokens { get; init; }
}

public sealed class ChatMessage
{
    public required string Role { get; init; }
    public string? Content { get; init; }
    public List<ToolCall>? ToolCalls { get; init; }
    public string? ToolCallId { get; init; }
    public string? Name { get; init; }
}

public sealed class ToolCall
{
    public required string Id { get; init; }
    public string Type { get; init; } = "function";
    public required ToolCallFunction Function { get; init; }
}

public sealed class ToolCallFunction
{
    public required string Name { get; init; }
    public required string Arguments { get; init; }
}

public sealed class ToolSchema
{
    public string Type { get; init; } = "function";
    public required ToolSchemaFunction Function { get; init; }
}

public sealed class ToolSchemaFunction
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required Dictionary<string, object> Parameters { get; init; }
    public bool? Strict { get; init; }
}

public sealed class ChatCompletionResponse
{
    public required string Id { get; init; }
    public required List<ChatChoice> Choices { get; init; }
    public required ChatUsage Usage { get; init; }
}

public sealed class ChatChoice
{
    public required ChatChoiceMessage Message { get; init; }
    public required string FinishReason { get; init; }
}

public sealed class ChatChoiceMessage
{
    public required string Role { get; init; }
    public string? Content { get; init; }
    public List<ToolCall>? ToolCalls { get; init; }
}

public sealed class ChatUsage
{
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens { get; init; }
}
