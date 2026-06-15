using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class EventDetectionEvidenceExtractor
{
    public static void Extract(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        var fileId = parsedData.TryGetProperty("fileId", out var fileIdEl)
            ? fileIdEl.GetString() ?? "unknown"
            : "unknown";
        var kind = parsedData.TryGetProperty("kind", out var kindEl)
            ? kindEl.GetString() ?? "unknown"
            : "unknown";
        var eventCount = parsedData.TryGetProperty("eventCount", out var countEl)
            ? countEl.GetInt32()
            : 0;

        var evidenceId = $"ev_{kind}_{fileId[..Math.Min(fileId.Length, 8)]}";
        var evidenceData = new Dictionary<string, object?>
        {
            ["fileId"] = fileId,
            ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
            ["type"] = "event_detection",
            ["kind"] = kind,
            ["eventCount"] = eventCount,
            ["eventsDetected"] = eventCount > 0,
        };

        if (kind == "clipping" && parsedData.TryGetProperty("events", out var eventsArray))
        {
            evidenceData["firstEvents"] = ExtractFirstClippingEvents(eventsArray);
        }

        evidenceItems.Add(
            new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "event_detection",
                Data = evidenceData,
            }
        );
    }

    private static List<object?> ExtractFirstClippingEvents(JsonElement eventsArray)
    {
        var firstFewEvents = new List<object?>();
        var eventIndex = 0;

        foreach (var audioEvent in eventsArray.EnumerateArray())
        {
            if (eventIndex >= 3)
            {
                break;
            }

            var startSeconds = audioEvent.TryGetProperty("startSeconds", out var startEl)
                ? startEl.GetDouble()
                : 0.0;
            var endSeconds = audioEvent.TryGetProperty("endSeconds", out var endEl)
                ? endEl.GetDouble()
                : 0.0;
            var description = audioEvent.TryGetProperty("description", out var descEl)
                ? descEl.GetString()
                : "";

            firstFewEvents.Add(
                new
                {
                    startSeconds,
                    endSeconds,
                    description,
                }
            );
            eventIndex++;
        }

        return firstFewEvents;
    }
}
