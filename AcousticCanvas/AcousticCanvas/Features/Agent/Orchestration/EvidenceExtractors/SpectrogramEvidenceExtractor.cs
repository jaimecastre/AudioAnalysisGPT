using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class SpectrogramEvidenceExtractor
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
            var evidenceId = "ev_spectrogram_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = EvidenceTypes.Spectrogram,
            };

            if (fileResult.TryGetProperty("region", out var regionElement))
            {
                AddRegionFields(regionElement, evidenceData);
            }

            if (fileResult.TryGetProperty("parameters", out var parametersElement))
            {
                AddParameterFields(parametersElement, evidenceData);
            }

            if (fileResult.TryGetProperty("summary", out var summaryElement))
            {
                AddSummaryFields(summaryElement, evidenceData);
            }

            if (fileResult.TryGetProperty("dataRef", out var dataRefElement))
            {
                evidenceData["dataRef"] = dataRefElement.GetString();
            }

            if (fileResult.TryGetProperty("resultId", out var resultIdElement))
            {
                evidenceData["resultId"] = resultIdElement.GetString();
            }

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = evidenceId,
                    Type = EvidenceTypes.Spectrogram,
                    Data = evidenceData,
                }
            );
        }
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

        if (regionElement.TryGetProperty("durationSeconds", out var durationElement))
        {
            evidenceData["durationSeconds"] = durationElement.GetDouble();
        }
    }

    private static void AddParameterFields(
        JsonElement parametersElement,
        Dictionary<string, object?> evidenceData
    )
    {
        if (parametersElement.TryGetProperty("fftSize", out var fftSizeElement))
        {
            evidenceData["fftSize"] = fftSizeElement.GetInt32();
        }

        if (parametersElement.TryGetProperty("overlap", out var overlapElement))
        {
            evidenceData["overlap"] = overlapElement.GetDouble();
        }

        if (parametersElement.TryGetProperty("scale", out var scaleElement))
        {
            evidenceData["scale"] = scaleElement.GetString();
        }

        if (parametersElement.TryGetProperty("gainDb", out var gainElement))
        {
            evidenceData["gainDb"] = gainElement.GetDouble();
        }

        if (parametersElement.TryGetProperty("rangeDb", out var rangeElement))
        {
            evidenceData["rangeDb"] = rangeElement.GetDouble();
        }
    }

    private static void AddSummaryFields(
        JsonElement summaryElement,
        Dictionary<string, object?> evidenceData
    )
    {
        if (summaryElement.TryGetProperty("frameCount", out var frameCountElement))
        {
            evidenceData["frameCount"] = frameCountElement.GetInt32();
        }

        if (summaryElement.TryGetProperty("binCount", out var binCountElement))
        {
            evidenceData["binCount"] = binCountElement.GetInt32();
        }

        if (summaryElement.TryGetProperty("nyquistHz", out var nyquistElement))
        {
            evidenceData["nyquistHz"] = nyquistElement.GetDouble();
        }
    }
}
