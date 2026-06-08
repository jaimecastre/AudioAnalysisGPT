using AcousticCanvas.Features.Agent.Domain;
using AcousticCanvas.Features.Agent.Services;
using Microsoft.Extensions.Configuration;

namespace AcousticCanvas.Tests;

public sealed class OpenAiChatServiceTests
{
    private static IConfiguration EmptyConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
    }

    [Fact]
    public void ConstructionDoesNotThrowWhenApiKeyIsMissing()
    {
        var exception = Record.Exception(() => new OpenAiChatService(EmptyConfiguration()));

        Assert.Null(exception);
    }

    [Fact]
    public async Task CompleteAsyncThrowsConfiguredErrorWhenApiKeyIsMissing()
    {
        var service = new OpenAiChatService(EmptyConfiguration());
        var request = new ChatCompletionRequest
        {
            Messages = [new ChatMessage { Role = "user", Content = "hello" }],
        };

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CompleteAsync(request, CancellationToken.None));

        Assert.Contains("not configured", exception.Message);
        Assert.Contains("OPENAI_API_KEY", exception.Message);
        Assert.DoesNotContain("VITE_OPENAI_API_KEY", exception.Message);
    }
}
