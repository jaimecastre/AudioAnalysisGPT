using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Handlers;

namespace AcousticCanvas.Tests;

public sealed class CompareSoundQualityBuilderTests
{
    [Fact]
    public void BuildDeltaAndUnavailableReason_ReturnsMetricDeltasAndWinnerFileIds()
    {
        var a = BuildSummary(
            fileId: "file_a",
            loudness: 12.2,
            sharpness: 1.15,
            roughness: 0.0421,
            unavailableReason: null
        );
        var b = BuildSummary(
            fileId: "file_b",
            loudness: 10.7,
            sharpness: 1.31,
            roughness: 0.0380,
            unavailableReason: null
        );

        var (delta, unavailableReason) = CompareSoundQualityBuilder.BuildDeltaAndUnavailableReason(
            a,
            b
        );

        Assert.NotNull(delta);
        Assert.Null(unavailableReason);

        Assert.Equal(-1.5, delta!.LoudnessDeltaSone);
        Assert.Equal(0.16, delta.SharpnessDeltaAcum);
        Assert.Equal(-0.0041, delta.RoughnessDeltaAsper);
        Assert.Equal("file_a", delta.LouderFileId);
        Assert.Equal("file_b", delta.SharperFileId);
        Assert.Equal("file_a", delta.RougherFileId);
    }

    [Fact]
    public void BuildDeltaAndUnavailableReason_WhenAnySoundQualityMissing_ReturnsNullDeltaAndReason()
    {
        var a = BuildSummary(
            fileId: "file_a",
            loudness: 12.2,
            sharpness: 1.15,
            roughness: 0.0421,
            unavailableReason: null
        );
        var b = BuildSummary(
            fileId: "file_b",
            loudness: null,
            sharpness: null,
            roughness: null,
            unavailableReason: "Sound quality metrics unavailable for file_b."
        );

        var (delta, unavailableReason) = CompareSoundQualityBuilder.BuildDeltaAndUnavailableReason(
            a,
            b
        );

        Assert.Null(delta);
        Assert.Equal("Sound quality metrics unavailable for file_b.", unavailableReason);
    }

    private static CompareFileSummary BuildSummary(
        string fileId,
        double? loudness,
        double? sharpness,
        double? roughness,
        string? unavailableReason
    )
    {
        CompareSoundQuality? soundQuality = null;

        if (loudness.HasValue && sharpness.HasValue && roughness.HasValue)
        {
            soundQuality = new CompareSoundQuality
            {
                LoudnessSone = loudness.Value,
                SharpnessAcum = sharpness.Value,
                RoughnessAsper = roughness.Value,
                Method = "mosqito_stationary_zwicker",
            };
        }

        return new CompareFileSummary
        {
            FileId = fileId,
            FileName = fileId + ".wav",
            PeakDb = -3.2,
            RmsDb = -18.4,
            CrestFactorDb = 15.2,
            PeakFrequencyHz = 1000,
            PeakFrequencyMagnitudeDb = -22.1,
            RegionStartSeconds = 0,
            RegionEndSeconds = 1,
            SpectrumCurve = new CompareSpectrumCurve
            {
                FrequenciesHz = [1000],
                MagnitudesDb = [-22.1],
                FftSize = 8192,
                Overlap = 0.5,
            },
            BandEnergies =
            [
                new CompareBandEnergy
                {
                    BandName = "mid",
                    LowHz = 800,
                    HighHz = 2500,
                    EnergyDb = -20.4,
                },
            ],
            CpbBands =
            [
                new CompareCpbBand
                {
                    Label = "1000",
                    CenterFrequencyHz = 1000,
                    LowerFrequencyHz = 891,
                    UpperFrequencyHz = 1122,
                    LevelDb = -21.3,
                    Weighting = "z",
                    WeightingMethod = "z_weighting_flat",
                },
            ],
            SoundQuality = soundQuality,
            SoundQualityUnavailableReason = unavailableReason,
        };
    }
}
