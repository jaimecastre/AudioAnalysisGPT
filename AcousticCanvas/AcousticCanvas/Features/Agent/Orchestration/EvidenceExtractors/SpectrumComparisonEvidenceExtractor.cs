using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class SpectrumComparisonEvidenceExtractor
{
    public static void TryEmit(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        var fileResults =
            new List<(string FileId, double PeakFreq, double MaxMag, List<object?> Peaks)>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
            {
                continue;
            }

            var fileId = fileIdEl.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("summary", out var summaryEl))
            {
                continue;
            }

            var peakFreq = summaryEl.TryGetProperty("peakFrequencyHz", out var freqEl)
                ? freqEl.GetDouble()
                : double.NaN;
            var maxMag = summaryEl.TryGetProperty("maxMagnitudeDb", out var magEl)
                ? magEl.GetDouble()
                : double.NaN;

            if (double.IsNaN(peakFreq))
            {
                continue;
            }

            var peaks = new List<object?>();
            if (summaryEl.TryGetProperty("dominantPeaks", out var peaksArray))
            {
                foreach (var peak in peaksArray.EnumerateArray())
                {
                    var freqHz = peak.TryGetProperty("frequencyHz", out var f)
                        ? f.GetDouble()
                        : 0.0;
                    var magDb = peak.TryGetProperty("magnitudeDb", out var m) ? m.GetDouble() : 0.0;
                    peaks.Add(new { frequencyHz = freqHz, magnitudeDb = magDb });
                }
            }

            fileResults.Add((fileId, peakFreq, maxMag, peaks));
        }

        if (fileResults.Count < 2)
        {
            return;
        }

        var a = fileResults[0];
        var b = fileResults[1];

        var peakFreqDelta = Math.Round(b.PeakFreq - a.PeakFreq, 1);
        var maxMagDelta = Math.Round(b.MaxMag - a.MaxMag, 2);
        var evidenceId = "ev_spectrum_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(
            new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "spectrum_comparison",
                Data = new Dictionary<string, object?>
                {
                    ["type"] = "spectrum_comparison",
                    ["fileIdA"] = a.FileId,
                    ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                    ["fileIdB"] = b.FileId,
                    ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                    ["peakFrequencyAHz"] = a.PeakFreq,
                    ["peakFrequencyBHz"] = b.PeakFreq,
                    ["peakFrequencyDeltaHz"] = peakFreqDelta,
                    ["maxMagnitudeADb"] = a.MaxMag,
                    ["maxMagnitudeBDb"] = b.MaxMag,
                    ["maxMagnitudeDeltaDb"] = maxMagDelta,
                    ["dominantPeaksA"] = a.Peaks,
                    ["dominantPeaksB"] = b.Peaks,
                },
            }
        );
    }
}
