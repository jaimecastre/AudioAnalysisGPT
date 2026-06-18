using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class FindingsEvidenceExtractor
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
        var findingCount = parsedData.TryGetProperty("findingCount", out var countEl)
            ? countEl.GetInt32()
            : 0;

        var evidenceId = "ev_findings_" + fileId[..Math.Min(fileId.Length, 8)];
        var evidenceData = new Dictionary<string, object?>
        {
            ["fileId"] = fileId,
            ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
            ["type"] = EvidenceTypes.Findings,
            ["findingCount"] = findingCount,
        };

        if (parsedData.TryGetProperty("findings", out var findingsArray))
        {
            evidenceData["findings"] = ExtractFindings(findingsArray);
        }

        evidenceItems.Add(
            new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = EvidenceTypes.Findings,
                Data = evidenceData,
            }
        );
    }

    private static List<object?> ExtractFindings(JsonElement findingsArray)
    {
        var findingsList = new List<object?>();

        foreach (var finding in findingsArray.EnumerateArray())
        {
            var findingType = finding.TryGetProperty("type", out var typeEl)
                ? typeEl.GetString()
                : null;
            var severity = finding.TryGetProperty("severity", out var sevEl)
                ? sevEl.GetString()
                : null;
            var confidence = finding.TryGetProperty("confidence", out var confEl)
                ? confEl.GetString()
                : null;
            var title = finding.TryGetProperty("title", out var titleEl)
                ? titleEl.GetString()
                : null;
            var description = finding.TryGetProperty("description", out var descEl)
                ? descEl.GetString()
                : null;
            var suggestedNextStep = finding.TryGetProperty("suggestedNextStep", out var nextEl)
                ? nextEl.GetString()
                : null;

            double? startSeconds =
                finding.TryGetProperty("startSeconds", out var startEl)
                && startEl.ValueKind != JsonValueKind.Null
                    ? startEl.GetDouble()
                    : null;

            double? endSeconds =
                finding.TryGetProperty("endSeconds", out var endEl)
                && endEl.ValueKind != JsonValueKind.Null
                    ? endEl.GetDouble()
                    : null;

            double? frequencyHz =
                finding.TryGetProperty("frequencyHz", out var freqEl)
                && freqEl.ValueKind != JsonValueKind.Null
                    ? freqEl.GetDouble()
                    : null;

            findingsList.Add(
                new
                {
                    type = findingType,
                    severity,
                    confidence,
                    title,
                    description,
                    suggestedNextStep,
                    startSeconds,
                    endSeconds,
                    frequencyHz,
                }
            );
        }

        return findingsList;
    }
}
