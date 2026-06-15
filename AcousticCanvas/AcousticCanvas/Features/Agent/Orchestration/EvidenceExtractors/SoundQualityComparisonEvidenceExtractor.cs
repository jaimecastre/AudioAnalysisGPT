using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

public static class SoundQualityComparisonEvidenceExtractor
{
    public static void TryEmit(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        var fileResults =
            new List<(string FileId, double Loudness, double Sharpness, double Roughness)>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
            {
                continue;
            }

            var fileId = fileIdEl.GetString() ?? "unknown";

            if (
                !fileResult.TryGetProperty("loudness", out var loudnessEl)
                || !loudnessEl.TryGetProperty("value", out var loudnessValEl)
            )
            {
                continue;
            }

            if (
                !fileResult.TryGetProperty("sharpness", out var sharpnessEl)
                || !sharpnessEl.TryGetProperty("value", out var sharpnessValEl)
            )
            {
                continue;
            }

            if (
                !fileResult.TryGetProperty("roughness", out var roughnessEl)
                || !roughnessEl.TryGetProperty("value", out var roughnessValEl)
            )
            {
                continue;
            }

            fileResults.Add(
                (
                    fileId,
                    loudnessValEl.GetDouble(),
                    sharpnessValEl.GetDouble(),
                    roughnessValEl.GetDouble()
                )
            );
        }

        if (fileResults.Count < 2)
        {
            return;
        }

        var a = fileResults[0];
        var b = fileResults[1];

        var loudnessDelta = Math.Round(b.Loudness - a.Loudness, 3);
        var sharpnessDelta = Math.Round(b.Sharpness - a.Sharpness, 4);
        var roughnessDelta = Math.Round(b.Roughness - a.Roughness, 4);
        var cmpEvidenceId = "ev_sq_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(
            new EvidenceItem
            {
                EvidenceId = cmpEvidenceId,
                Type = "sound_quality_comparison",
                Data = new Dictionary<string, object?>
                {
                    ["type"] = "sound_quality_comparison",
                    ["fileIdA"] = a.FileId,
                    ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                    ["fileIdB"] = b.FileId,
                    ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                    ["loudnessASone"] = Math.Round(a.Loudness, 3),
                    ["loudnessBSone"] = Math.Round(b.Loudness, 3),
                    ["loudnessDeltaSone"] = loudnessDelta,
                    ["louderFileId"] = a.Loudness >= b.Loudness ? a.FileId : b.FileId,
                    ["sharpnessAAcum"] = Math.Round(a.Sharpness, 4),
                    ["sharpnessBAcum"] = Math.Round(b.Sharpness, 4),
                    ["sharpnessDeltaAcum"] = sharpnessDelta,
                    ["sharperFileId"] = a.Sharpness >= b.Sharpness ? a.FileId : b.FileId,
                    ["roughnessAAsper"] = Math.Round(a.Roughness, 4),
                    ["roughnessBAsper"] = Math.Round(b.Roughness, 4),
                    ["roughnessDeltaAsper"] = roughnessDelta,
                    ["rougherFileId"] = a.Roughness >= b.Roughness ? a.FileId : b.FileId,
                },
            }
        );
    }
}
