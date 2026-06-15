using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Handlers;

namespace AcousticCanvas.Tests;

public sealed class BatchBenchmarkBuilderTests
{
    [Fact]
    public void Build_ReturnsRankingsSortedByMetricDirection()
    {
        var rows = new[]
        {
            BuildSource(
                "quiet",
                rmsDb: -24,
                peakDb: -8,
                sharpness: 0.5,
                roughness: 0.001,
                findings: []
            ),
            BuildSource(
                "loud",
                rmsDb: -12,
                peakDb: -2,
                sharpness: 1.2,
                roughness: 0.005,
                findings: []
            ),
            BuildSource(
                "middle",
                rmsDb: -18,
                peakDb: -4,
                sharpness: 0.8,
                roughness: 0.003,
                findings: []
            ),
        };

        var result = BatchBenchmarkBuilder.Build(rows, DateTimeOffset.UnixEpoch);

        var rmsRanking = Assert.Single(result.Rankings, ranking => ranking.Metric == "rmsDb");
        Assert.Equal(["loud", "middle", "quiet"], rmsRanking.FileIds);

        var sharpnessRanking = Assert.Single(
            result.Rankings,
            ranking => ranking.Metric == "sharpnessAcum"
        );
        Assert.Equal(["loud", "middle", "quiet"], sharpnessRanking.FileIds);
    }

    [Fact]
    public void Build_FlagsIqrOutliersWhenAtLeastFourFilesAreAvailable()
    {
        var rows = new[]
        {
            BuildSource(
                "a",
                rmsDb: -21,
                peakDb: -6,
                sharpness: 0.5,
                roughness: 0.001,
                findings: []
            ),
            BuildSource(
                "b",
                rmsDb: -20,
                peakDb: -6,
                sharpness: 0.6,
                roughness: 0.001,
                findings: []
            ),
            BuildSource(
                "c",
                rmsDb: -19,
                peakDb: -5,
                sharpness: 0.7,
                roughness: 0.001,
                findings: []
            ),
            BuildSource(
                "outlier",
                rmsDb: -4,
                peakDb: -1,
                sharpness: 3.2,
                roughness: 0.001,
                findings: []
            ),
        };

        var result = BatchBenchmarkBuilder.Build(rows, DateTimeOffset.UnixEpoch);

        Assert.Contains(
            result.Outliers,
            outlier =>
                outlier.FileId == "outlier"
                && outlier.Metric == "rmsDb"
                && outlier.Direction == "high"
        );
        Assert.Contains(
            result.Outliers,
            outlier =>
                outlier.FileId == "outlier"
                && outlier.Metric == "sharpnessAcum"
                && outlier.Direction == "high"
        );
    }

    [Fact]
    public void Build_WhenSmallSample_ReturnsNoOutliersAndSmallSampleLimitation()
    {
        var rows = new[]
        {
            BuildSource(
                "a",
                rmsDb: -30,
                peakDb: -10,
                sharpness: 0.5,
                roughness: 0.001,
                findings: []
            ),
            BuildSource("b", rmsDb: -4, peakDb: -1, sharpness: 3.2, roughness: 0.001, findings: []),
        };

        var result = BatchBenchmarkBuilder.Build(rows, DateTimeOffset.UnixEpoch);

        Assert.Empty(result.Outliers);
        Assert.Contains(
            result.Limitations,
            limitation =>
                limitation.Contains("at least 4 files", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void Build_CarriesSoundQualityUnavailableLimitationPerFile()
    {
        var rows = new[]
        {
            BuildSource(
                "a",
                rmsDb: -20,
                peakDb: -5,
                sharpness: null,
                roughness: null,
                findings: [],
                soundQualityUnavailableReason: "Sound-quality metrics unavailable for this file."
            ),
            BuildSource(
                "b",
                rmsDb: -18,
                peakDb: -3,
                sharpness: 0.8,
                roughness: 0.001,
                findings: []
            ),
        };

        var result = BatchBenchmarkBuilder.Build(rows, DateTimeOffset.UnixEpoch);

        Assert.Contains(
            result.Limitations,
            limitation =>
                limitation.Contains("a.wav", StringComparison.OrdinalIgnoreCase)
                && limitation.Contains(
                    "Sound-quality metrics unavailable",
                    StringComparison.OrdinalIgnoreCase
                )
        );
    }

    private static BatchBenchmarkSource BuildSource(
        string fileId,
        double rmsDb,
        double peakDb,
        double? sharpness,
        double? roughness,
        IReadOnlyList<Finding> findings,
        string? soundQualityUnavailableReason = null
    )
    {
        CompareSoundQuality? soundQuality = null;

        if (sharpness.HasValue && roughness.HasValue)
        {
            soundQuality = new CompareSoundQuality
            {
                LoudnessSone = 12.0,
                SharpnessAcum = sharpness.Value,
                RoughnessAsper = roughness.Value,
                Method = "mosqito_stationary_zwicker",
            };
        }

        var summary = new CompareFileSummary
        {
            FileId = fileId,
            FileName = fileId + ".wav",
            PeakDb = peakDb,
            RmsDb = rmsDb,
            CrestFactorDb = Math.Round(peakDb - rmsDb, 2),
            PeakFrequencyHz = 1000,
            PeakFrequencyMagnitudeDb = -15,
            RegionStartSeconds = 0,
            RegionEndSeconds = 5,
            SpectrumCurve = new CompareSpectrumCurve
            {
                FrequenciesHz = [1000],
                MagnitudesDb = [-15],
                FftSize = 8192,
                Overlap = 0.5,
            },
            BandEnergies = [],
            CpbBands = [],
            SoundQuality = soundQuality,
            SoundQualityUnavailableReason = soundQualityUnavailableReason,
        };

        return new BatchBenchmarkSource(summary, findings);
    }
}
