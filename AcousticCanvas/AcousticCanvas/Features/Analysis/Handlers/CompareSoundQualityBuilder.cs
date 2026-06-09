using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Handlers;

public static class CompareSoundQualityBuilder
{
    public static (CompareSoundQualityDelta? Delta, string? UnavailableReason) BuildDeltaAndUnavailableReason(
        CompareFileSummary fileA,
        CompareFileSummary fileB)
    {
        if (fileA.SoundQuality is null || fileB.SoundQuality is null)
        {
            var unavailableReason = fileA.SoundQualityUnavailableReason
                ?? fileB.SoundQualityUnavailableReason
                ?? "Sound-quality comparison is unavailable because one or more files could not be analyzed with the Python sidecar.";

            return (null, unavailableReason);
        }

        var soundQualityA = fileA.SoundQuality;
        var soundQualityB = fileB.SoundQuality;

        var delta = new CompareSoundQualityDelta
        {
            LoudnessDeltaSone = Math.Round(soundQualityB.LoudnessSone - soundQualityA.LoudnessSone, 3),
            SharpnessDeltaAcum = Math.Round(soundQualityB.SharpnessAcum - soundQualityA.SharpnessAcum, 4),
            RoughnessDeltaAsper = Math.Round(soundQualityB.RoughnessAsper - soundQualityA.RoughnessAsper, 4),
            LouderFileId = soundQualityA.LoudnessSone >= soundQualityB.LoudnessSone ? fileA.FileId : fileB.FileId,
            SharperFileId = soundQualityA.SharpnessAcum >= soundQualityB.SharpnessAcum ? fileA.FileId : fileB.FileId,
            RougherFileId = soundQualityA.RoughnessAsper >= soundQualityB.RoughnessAsper ? fileA.FileId : fileB.FileId,
        };

        return (delta, null);
    }
}