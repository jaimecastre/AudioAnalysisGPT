using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class SoundQualityEvidenceExtractor
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
            var evidenceId = "ev_sound_quality_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "sound_quality",
            };

            if (fileResult.TryGetProperty("method", out var methodElement))
            {
                evidenceData["method"] = methodElement.GetString();
            }

            if (fileResult.TryGetProperty("region", out var regionElement))
            {
                AddRegionFields(regionElement, evidenceData);
            }

            AddMetricEvidence(
                fileResult,
                evidenceData,
                "loudness",
                "loudnessSone",
                "loudnessMethod"
            );
            AddMetricEvidence(
                fileResult,
                evidenceData,
                "sharpness",
                "sharpnessAcum",
                "sharpnessMethod"
            );
            AddMetricEvidence(
                fileResult,
                evidenceData,
                "roughness",
                "roughnessAsper",
                "roughnessMethod"
            );

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = evidenceId,
                    Type = "sound_quality",
                    Data = evidenceData,
                }
            );
        }

        SoundQualityComparisonEvidenceExtractor.TryEmit(
            resultsArray,
            evidenceItems,
            fileIdToNameMap
        );
    }

    private static void AddRegionFields(
        JsonElement regionElement,
        Dictionary<string, object?> evidenceData
    )
    {
        if (regionElement.TryGetProperty("startSeconds", out var startElement))
        {
            evidenceData["regionStartSeconds"] = startElement.GetDouble();
        }

        if (regionElement.TryGetProperty("endSeconds", out var endElement))
        {
            evidenceData["regionEndSeconds"] = endElement.GetDouble();
        }
    }

    private static void AddMetricEvidence(
        JsonElement fileResult,
        Dictionary<string, object?> evidenceData,
        string metricPropertyName,
        string valueEvidenceKey,
        string methodEvidenceKey
    )
    {
        if (!fileResult.TryGetProperty(metricPropertyName, out var metricElement))
        {
            return;
        }

        if (metricElement.TryGetProperty("value", out var valueElement))
        {
            evidenceData[valueEvidenceKey] = valueElement.GetDouble();
        }

        if (metricElement.TryGetProperty("method", out var methodElement))
        {
            evidenceData[methodEvidenceKey] = methodElement.GetString();
        }
    }
}
