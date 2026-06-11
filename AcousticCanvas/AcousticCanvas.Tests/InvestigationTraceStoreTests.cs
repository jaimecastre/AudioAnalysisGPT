using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Services;

namespace AcousticCanvas.Tests;

public sealed class InvestigationTraceStoreTests
{
    [Fact]
    public void StoreAndRetrieveLatestTraceByConversationId()
    {
        var store = new InvestigationTraceStore();
        var conversationId = "conv_test123";
        
        var trace = new InvestigationTrace(
            Question: "What is the peak level?",
            ConversationId: conversationId,
            Path: InvestigationPath.DeterministicFact,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "The peak level is -3.2 dBFS.",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        store.Store(trace);
        
        var retrieved = store.GetLatest(conversationId);
        
        Assert.NotNull(retrieved);
        Assert.Equal(conversationId, retrieved!.ConversationId);
        Assert.Equal("What is the peak level?", retrieved.Question);
        Assert.Equal(InvestigationPath.DeterministicFact, retrieved.Path);
    }

    [Fact]
    public void StoreRetainsMultipleTracesForSameConversationId()
    {
        var store = new InvestigationTraceStore();
        var conversationId = "conv_multi123";
        
        var trace1 = new InvestigationTrace(
            Question: "First question",
            ConversationId: conversationId,
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "First answer",
            Confidence: "medium",
            TimestampUtc: DateTime.UtcNow.AddMinutes(-5));

        var trace2 = new InvestigationTrace(
            Question: "Second question",
            ConversationId: conversationId,
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "Second answer",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        store.Store(trace1);
        store.Store(trace2);
        
        var allTraces = store.GetByConversationId(conversationId);
        
        Assert.Equal(2, allTraces.Count);
        Assert.Equal("First question", allTraces[0].Question);
        Assert.Equal("Second question", allTraces[1].Question);
    }

    [Fact]
    public void GetLatestReturnsMostRecentTrace()
    {
        var store = new InvestigationTraceStore();
        var conversationId = "conv_latest123";
        
        var trace1 = new InvestigationTrace(
            Question: "Old question",
            ConversationId: conversationId,
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "Old answer",
            Confidence: "medium",
            TimestampUtc: DateTime.UtcNow.AddMinutes(-10));

        var trace2 = new InvestigationTrace(
            Question: "New question",
            ConversationId: conversationId,
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: [],
            FinalAnswer: "New answer",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        store.Store(trace1);
        store.Store(trace2);
        
        var latest = store.GetLatest(conversationId);
        
        Assert.NotNull(latest);
        Assert.Equal("New question", latest!.Question);
    }

    [Fact]
    public void GetByConversationIdReturnsEmptyListForUnknownConversation()
    {
        var store = new InvestigationTraceStore();
        
        var traces = store.GetByConversationId("conv_unknown");
        
        Assert.Empty(traces);
    }

    [Fact]
    public void GetLatestReturnsNullForUnknownConversation()
    {
        var store = new InvestigationTraceStore();
        
        var trace = store.GetLatest("conv_unknown");
        
        Assert.Null(trace);
    }

    [Fact]
    public void InvestigationTraceWithPlannedTools()
    {
        var plannedTool = new PlannedToolTrace(
            Name: "run_spectrum",
            Arguments: new Dictionary<string, object?> { ["fileIds"] = new[] { "file1" } });

        var trace = new InvestigationTrace(
            Question: "What is the spectrum?",
            ConversationId: "conv_planned123",
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: new[] { plannedTool },
            ToolExecutions: [],
            FinalAnswer: "The spectrum shows a peak at 1 kHz.",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        Assert.Single(trace.PlannedTools);
        Assert.Equal("run_spectrum", trace.PlannedTools[0].Name);
    }

    [Fact]
    public void InvestigationTraceWithToolExecutions()
    {
        var toolExecution = new ToolExecutionTrace(
            Name: "run_spectrum",
            Status: "completed",
            StartedAtUtc: DateTime.UtcNow.AddSeconds(-1),
            FinishedAtUtc: DateTime.UtcNow,
            ErrorMessage: null);

        var trace = new InvestigationTrace(
            Question: "What is the spectrum?",
            ConversationId: "conv_exec123",
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: new[] { toolExecution },
            FinalAnswer: "The spectrum shows a peak at 1 kHz.",
            Confidence: "high",
            TimestampUtc: DateTime.UtcNow);

        Assert.Single(trace.ToolExecutions);
        Assert.Equal("run_spectrum", trace.ToolExecutions[0].Name);
        Assert.Equal("completed", trace.ToolExecutions[0].Status);
    }

    [Fact]
    public void InvestigationTraceWithFailedToolExecution()
    {
        var toolExecution = new ToolExecutionTrace(
            Name: "run_spectrum",
            Status: "failed",
            StartedAtUtc: DateTime.UtcNow.AddSeconds(-1),
            FinishedAtUtc: DateTime.UtcNow,
            ErrorMessage: "File not found");

        var trace = new InvestigationTrace(
            Question: "What is the spectrum?",
            ConversationId: "conv_failed123",
            Path: InvestigationPath.LlmPlanned,
            PlannedTools: [],
            ToolExecutions: new[] { toolExecution },
            FinalAnswer: "Could not analyze spectrum.",
            Confidence: "low",
            TimestampUtc: DateTime.UtcNow);

        Assert.Single(trace.ToolExecutions);
        Assert.Equal("failed", trace.ToolExecutions[0].Status);
        Assert.Equal("File not found", trace.ToolExecutions[0].ErrorMessage);
    }
}
