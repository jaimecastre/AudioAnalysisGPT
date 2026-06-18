using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class BasicMetricsEvidenceExtractor
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

            if (!fileResult.TryGetProperty("metrics", out var metricsElement))
            {
                continue;
            }

            var evidenceId = "ev_metrics_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = EvidenceTypes.BasicMetrics,
            };

            if (metricsElement.TryGetProperty("rmsDbFs", out var rmsElement))
            {
                evidenceData["rmsDbFs"] = rmsElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("peakDbFs", out var peakElement))
            {
                evidenceData["peakDbFs"] = peakElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("crestFactorDb", out var crestElement))
            {
                evidenceData["crestFactorDb"] = crestElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("dcOffsetLinear", out var dcOffsetElement))
            {
                evidenceData["dcOffsetLinear"] = dcOffsetElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("dbUnit", out var dbUnitElement))
            {
                evidenceData["levelDbUnit"] = dbUnitElement.GetString();
            }

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = evidenceId,
                    Type = EvidenceTypes.BasicMetrics,
                    Data = evidenceData,
                }
            );
        }

        LevelComparisonEvidenceExtractor.TryEmit(resultsArray, evidenceItems, fileIdToNameMap);
    }
}
