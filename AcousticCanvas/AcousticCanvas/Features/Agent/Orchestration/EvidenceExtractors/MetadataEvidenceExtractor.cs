using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class MetadataEvidenceExtractor
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
            var evidenceId = "ev_meta_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = EvidenceTypes.Metadata,
            };

            if (fileResult.TryGetProperty("durationSeconds", out var durationEl))
            {
                evidenceData["durationSeconds"] = durationEl.GetDouble();
            }

            if (fileResult.TryGetProperty("sampleRateHz", out var sampleRateEl))
            {
                evidenceData["sampleRateHz"] = sampleRateEl.GetInt32();
            }

            if (fileResult.TryGetProperty("channels", out var channelsEl))
            {
                evidenceData["channels"] = channelsEl.GetInt32();
            }

            if (fileResult.TryGetProperty("bitDepth", out var bitDepthEl))
            {
                evidenceData["bitDepth"] = bitDepthEl.GetInt32();
            }

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = evidenceId,
                    Type = EvidenceTypes.Metadata,
                    Data = evidenceData,
                }
            );
        }
    }
}
