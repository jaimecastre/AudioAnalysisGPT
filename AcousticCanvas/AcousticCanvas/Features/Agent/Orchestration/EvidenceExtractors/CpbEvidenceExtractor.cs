using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class CpbEvidenceExtractor
{
    public static void Extract(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("summary", out var summaryElement))
            {
                continue;
            }

            var evidenceId = "ev_cpb_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "cpb",
            };

            if (fileResult.TryGetProperty("bandMode", out var bandModeEl))
            {
                evidenceData["bandMode"] = bandModeEl.GetString();
            }

            if (fileResult.TryGetProperty("method", out var methodEl))
            {
                evidenceData["method"] = methodEl.GetString();
            }

            if (summaryElement.TryGetProperty("highestBands", out var bandsArray))
            {
                evidenceData["highestBands"] = ExtractHighestBands(bandsArray);
            }

            if (fileResult.TryGetProperty("dataRef", out var dataRefEl))
            {
                evidenceData["dataRef"] = dataRefEl.GetString();
            }

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = evidenceId,
                    Type = "cpb",
                    Data = evidenceData,
                }
            );
        }
    }

    private static List<object?> ExtractHighestBands(JsonElement bandsArray)
    {
        var bandsList = new List<object?>();

        foreach (var band in bandsArray.EnumerateArray())
        {
            var freqHz = band.TryGetProperty("centerFrequencyHz", out var freqEl)
                ? freqEl.GetDouble()
                : 0.0;
            var levelDb = band.TryGetProperty("levelDb", out var levelEl)
                ? levelEl.GetDouble()
                : 0.0;
            var label = band.TryGetProperty("label", out var labelEl) ? labelEl.GetString() : "";

            bandsList.Add(
                new
                {
                    centerFrequencyHz = freqHz,
                    levelDb,
                    label,
                }
            );
        }

        return bandsList;
    }
}
