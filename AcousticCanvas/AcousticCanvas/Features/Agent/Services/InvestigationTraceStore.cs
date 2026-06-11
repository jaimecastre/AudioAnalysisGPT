using AcousticCanvas.Features.Agent.Commands;
using System.Collections.Concurrent;

namespace AcousticCanvas.Features.Agent.Services;

public interface IInvestigationTraceStore
{
    void Store(InvestigationTrace trace);
    IReadOnlyList<InvestigationTrace> GetByConversationId(string conversationId);
    InvestigationTrace? GetLatest(string conversationId);
}

public sealed class InvestigationTraceStore : IInvestigationTraceStore
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<InvestigationTrace>> _traces = new();

    public void Store(InvestigationTrace trace)
    {
        var queue = _traces.GetOrAdd(trace.ConversationId, _ => new ConcurrentQueue<InvestigationTrace>());
        queue.Enqueue(trace);
    }

    public IReadOnlyList<InvestigationTrace> GetByConversationId(string conversationId)
    {
        if (_traces.TryGetValue(conversationId, out var queue))
        {
            return queue.ToArray();
        }
        return [];
    }

    public InvestigationTrace? GetLatest(string conversationId)
    {
        if (_traces.TryGetValue(conversationId, out var queue))
        {
            var allTraces = queue.ToArray();
            if (allTraces.Length > 0)
            {
                return allTraces[^1];
            }
        }
        return null;
    }
}
