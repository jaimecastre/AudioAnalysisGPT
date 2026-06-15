using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class LevelComparisonEvidenceExtractor
{
    public static void TryEmit(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        var fileResults =
            new List<(
                string FileId,
                double Rms,
                double Peak,
                double CrestFactor,
                string? DbUnit
            )>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
            {
                continue;
            }

            var fileId = fileIdEl.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("metrics", out var metricsEl))
            {
                continue;
            }

            var rms = metricsEl.TryGetProperty("rmsDbFs", out var rmsEl)
                ? rmsEl.GetDouble()
                : double.NaN;
            var peak = metricsEl.TryGetProperty("peakDbFs", out var peakEl)
                ? peakEl.GetDouble()
                : double.NaN;
            var crest = metricsEl.TryGetProperty("crestFactorDb", out var crestEl)
                ? crestEl.GetDouble()
                : double.NaN;
            var dbUnit = metricsEl.TryGetProperty("dbUnit", out var dbUnitEl)
                ? dbUnitEl.GetString()
                : null;

            if (double.IsNaN(rms) || double.IsNaN(peak))
            {
                continue;
            }

            fileResults.Add((fileId, rms, peak, crest, dbUnit));
        }

        if (fileResults.Count < 2)
        {
            return;
        }

        var a = fileResults[0];
        var b = fileResults[1];

        var rmsDelta = Math.Round(b.Rms - a.Rms, 2);
        var peakDelta = Math.Round(b.Peak - a.Peak, 2);
        var crestDelta = Math.Round(b.CrestFactor - a.CrestFactor, 2);
        var evidenceId = "ev_level_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(
            new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "level_comparison",
                Data = new Dictionary<string, object?>
                {
                    ["type"] = "level_comparison",
                    ["fileIdA"] = a.FileId,
                    ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                    ["fileIdB"] = b.FileId,
                    ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                    ["rmsADbFs"] = a.Rms,
                    ["rmsBDbFs"] = b.Rms,
                    ["rmsDeltaDb"] = rmsDelta,
                    ["louderFileId"] = a.Rms >= b.Rms ? a.FileId : b.FileId,
                    ["peakADbFs"] = a.Peak,
                    ["peakBDbFs"] = b.Peak,
                    ["peakDeltaDb"] = peakDelta,
                    ["higherPeakFileId"] = a.Peak >= b.Peak ? a.FileId : b.FileId,
                    ["crestFactorADb"] = a.CrestFactor,
                    ["crestFactorBDb"] = b.CrestFactor,
                    ["crestFactorDeltaDb"] = crestDelta,
                    ["moreDynamicFileId"] = a.CrestFactor >= b.CrestFactor ? a.FileId : b.FileId,
                    ["levelDbUnit"] = a.DbUnit ?? b.DbUnit,
                },
            }
        );
    }
}
