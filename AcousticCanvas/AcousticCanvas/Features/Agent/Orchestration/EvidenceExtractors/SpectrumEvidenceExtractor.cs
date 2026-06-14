using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class SpectrumEvidenceExtractor
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

            var evidenceId = "ev_spectrum_" + fileId[..Math.Min(fileId.Length, 8)];
            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "spectrum",
            };

            if (summaryElement.TryGetProperty("peakFrequencyHz", out var peakFreqEl))
            {
                evidenceData["peakFrequencyHz"] = peakFreqEl.GetDouble();
            }

            if (summaryElement.TryGetProperty("maxMagnitudeDb", out var maxMagEl))
            {
                evidenceData["maxMagnitudeDb"] = maxMagEl.GetDouble();
            }

            if (summaryElement.TryGetProperty("dominantPeaks", out var peaksArray))
            {
                evidenceData["dominantPeaks"] = ExtractDominantPeaks(peaksArray);
            }

            if (fileResult.TryGetProperty("dataRef", out var dataRefEl))
            {
                evidenceData["dataRef"] = dataRefEl.GetString();
            }

            // Include resultId for AnalysisViewBlock modal (stored in AnalysisResultCache)
            if (fileResult.TryGetProperty("resultId", out var resultIdEl))
            {
                var resultId = resultIdEl.GetString();
                evidenceData["resultId"] = resultId;
            }

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "spectrum",
                Data = evidenceData,
            });
        }

        SpectrumComparisonEvidenceExtractor.TryEmit(resultsArray, evidenceItems, fileIdToNameMap);
    }

    private static List<object?> ExtractDominantPeaks(JsonElement peaksArray)
    {
        var peaksList = new List<object?>();

        foreach (var peak in peaksArray.EnumerateArray())
        {
            var freqHz = peak.TryGetProperty("frequencyHz", out var freqEl) ? freqEl.GetDouble() : 0.0;
            var magDb = peak.TryGetProperty("magnitudeDb", out var magEl) ? magEl.GetDouble() : 0.0;
            var prominence = peak.TryGetProperty("prominenceDb", out var promEl) ? promEl.GetDouble() : 0.0;
            var confidence = peak.TryGetProperty("confidence", out var confEl) ? confEl.GetString() : "";

            peaksList.Add(new { frequencyHz = freqHz, magnitudeDb = magDb, prominenceDb = prominence, confidence });
        }

        return peaksList;
    }
}
