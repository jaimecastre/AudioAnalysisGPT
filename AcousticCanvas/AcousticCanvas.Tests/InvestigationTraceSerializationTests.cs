using AcousticCanvas.Features.Agent.Commands;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AcousticCanvas.Tests;

public sealed class InvestigationTraceSerializationTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public void InvestigationPathSerializesAsString()
    {
        var trace = new InvestigationTrace(
            Question: "Test question",
            ConversationId: "conv_test",
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "Test answer",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        var json = JsonSerializer.Serialize(trace, JsonOptions);
        
        Assert.Contains("\"path\":\"LlmPlanned\"", json);
        Assert.DoesNotContain("\"path\":0", json);
    }

    [Fact]
    public void InvestigationPathDeserializesFromString()
    {
        var json = """
        {
            "question": "Test question",
            "conversationId": "conv_test",
            "path": "DeterministicFact",
            "plannedTools": [],
            "toolExecutions": [],
            "finalAnswer": "Test answer",
            "confidence": "high",
            "timestampUtc": "2026-06-11T20:00:00Z"
        }
        """;

        var trace = JsonSerializer.Deserialize<InvestigationTrace>(json, JsonOptions);
        
        Assert.NotNull(trace);
        Assert.Equal(InvestigationPath.DeterministicFact, trace!.Path);
    }

    [Fact]
    public void AllInvestigationPathValuesSerializeCorrectly()
    {
        var paths = new[]
        {
            InvestigationPath.LlmPlanned,
            InvestigationPath.DeterministicFact,
            InvestigationPath.MetaQuestion,
            InvestigationPath.NoFiles
        };

        foreach (var path in paths)
        {
            var trace = new InvestigationTrace(
                Question: "Test",
                ConversationId: "conv_test",
                Path: path,
                PlannedTools: [],
                ToolExecutions: [],
                FinalAnswer: "Test",
                Confidence: "high",
                TimestampUtc: DateTime.UtcNow);

            var json = JsonSerializer.Serialize(trace, JsonOptions);
            var expectedString = $"\"path\":\"{path}\"";
            Assert.Contains(expectedString, json);
        }
    }
}
