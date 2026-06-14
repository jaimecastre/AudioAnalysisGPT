using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

public sealed class FindingsEngineTests
{
    private const string TestFileId = "test-file-001";

    [Fact]
    public void ClippingEventProducesHighSeverityFinding()
    {
        var eventResults = BuildEventResults("clipping", new AudioEvent
        {
            Kind = "clipping",
            StartSeconds = 1.0,
            EndSeconds = 1.01,
            DurationSeconds = 0.01,
            Description = "Clipping at 1.0s",
            Metadata = new Dictionary<string, object?>
            {
                ["sampleCount"] = 480,
                ["peakAmplitude"] = 1.0,
            },
        });

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), eventResults);

        Assert.Single(findings);
        Assert.Equal("clipping", findings[0].Type);
        Assert.Equal("high", findings[0].Severity);
        Assert.Equal("observed", findings[0].Confidence);
        Assert.Equal(1.0, findings[0].StartSeconds);
    }

    [Fact]
    public void ShortSilenceProducesMediumSeverityFinding()
    {
        var eventResults = BuildEventResults("silence", new AudioEvent
        {
            Kind = "silence",
            StartSeconds = 5.0,
            EndSeconds = 5.5,
            DurationSeconds = 0.5,
            Description = "Silence at 5.0s",
            Metadata = new Dictionary<string, object?>(),
        });

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), eventResults);

        Assert.Single(findings);
        Assert.Equal("silence_gap", findings[0].Type);
        Assert.Equal("medium", findings[0].Severity);
        Assert.Equal("Silence Gap", findings[0].Title);
    }

    [Fact]
    public void LongSilenceProducesHighSeverityFinding()
    {
        var eventResults = BuildEventResults("silence", new AudioEvent
        {
            Kind = "silence",
            StartSeconds = 2.0,
            EndSeconds = 4.0,
            DurationSeconds = 2.0,
            Description = "Silence at 2.0s",
            Metadata = new Dictionary<string, object?>(),
        });

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), eventResults);

        Assert.Single(findings);
        Assert.Equal("high", findings[0].Severity);
        Assert.Equal("Extended Silence Gap", findings[0].Title);
    }

    [Fact]
    public void HighCrestFactorProducesMediumSeverityFinding()
    {
        var level = BuildLevelWithCrestFactor(25.0);

        var findings = FindingsEngine.GenerateFindings(TestFileId, level, NoEvents());

        Assert.Single(findings);
        Assert.Equal("high_crest_factor", findings[0].Type);
        Assert.Equal("medium", findings[0].Severity);
        Assert.Equal("inferred", findings[0].Confidence);
    }

    [Fact]
    public void NormalCrestFactorProducesNoFinding()
    {
        var level = BuildLevelWithCrestFactor(15.0);

        var findings = FindingsEngine.GenerateFindings(TestFileId, level, NoEvents());

        Assert.Empty(findings);
    }

    [Fact]
    public void DcOffsetAboveThresholdProducesLowSeverityFinding()
    {
        var level = BuildLevelWithDcOffset(0.05);

        var findings = FindingsEngine.GenerateFindings(TestFileId, level, NoEvents());

        Assert.Single(findings);
        Assert.Equal("dc_offset", findings[0].Type);
        Assert.Equal("low", findings[0].Severity);
        Assert.Equal("observed", findings[0].Confidence);
    }

    [Fact]
    public void DcOffsetBelowThresholdProducesNoFinding()
    {
        var level = BuildLevelWithDcOffset(0.005);

        var findings = FindingsEngine.GenerateFindings(TestFileId, level, NoEvents());

        Assert.Empty(findings);
    }

    [Fact]
    public void TonalPeakProducesFinding()
    {
        var spectrum = BuildSpectrumWithTonalPeak(frequencyHz: 1000.0, prominenceDb: 20.0);

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), NoEvents(), spectrum);

        Assert.Single(findings);
        Assert.Equal("tonal_peak", findings[0].Type);
        Assert.Equal("medium", findings[0].Severity);
        Assert.Equal(1000.0, findings[0].FrequencyHz);
    }

    [Fact]
    public void LowProminenceTonalPeakProducesLowSeverityFinding()
    {
        var spectrum = BuildSpectrumWithTonalPeak(frequencyHz: 500.0, prominenceDb: 8.0);

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), NoEvents(), spectrum);

        Assert.Single(findings);
        Assert.Equal("low", findings[0].Severity);
    }

    [Fact]
    public void NoEventsAndCleanLevelProducesNoFindings()
    {
        var level = BuildCleanLevel();

        var findings = FindingsEngine.GenerateFindings(TestFileId, level, NoEvents());

        Assert.Empty(findings);
    }

    [Fact]
    public void FindingIdsAreSequentialAcrossTypes()
    {
        var clippingEvents = BuildEventResults("clipping", new AudioEvent
        {
            Kind = "clipping",
            StartSeconds = 0.5,
            EndSeconds = 0.51,
            DurationSeconds = 0.01,
            Description = "Clip",
            Metadata = new Dictionary<string, object?>(),
        });

        var silenceEvents = new List<FindEventsResult>(clippingEvents);
        silenceEvents.Add(new FindEventsResult
        {
            FileId = TestFileId,
            Kind = "silence",
            Events = [new AudioEvent
            {
                Kind = "silence",
                StartSeconds = 3.0,
                EndSeconds = 3.2,
                DurationSeconds = 0.2,
                Description = "Silence",
                Metadata = new Dictionary<string, object?>(),
            }],
            EventCount = 1,
            RegionStartSeconds = 0.0,
            RegionEndSeconds = 10.0,
            RanAt = DateTimeOffset.UtcNow,
        });

        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), silenceEvents);

        Assert.Equal(2, findings.Count);
        Assert.Equal("finding_001", findings[0].FindingId);
        Assert.Equal("finding_002", findings[1].FindingId);
    }

    [Fact]
    public void NoSpectrumProducesNoTonalPeakFinding()
    {
        var findings = FindingsEngine.GenerateFindings(TestFileId, EmptyLevel(), NoEvents(), null);

        Assert.Empty(findings);
    }

    // =================================================================
    // Helpers
    // =================================================================

    private static LevelAnalysis EmptyLevel()
    {
        return new LevelAnalysis { Channels = [] };
    }

    private static IReadOnlyList<FindEventsResult> NoEvents()
    {
        return [];
    }

    private static IReadOnlyList<FindEventsResult> BuildEventResults(string kind, AudioEvent singleEvent)
    {
        return
        [
            new FindEventsResult
            {
                FileId = TestFileId,
                Kind = kind,
                Events = [singleEvent],
                EventCount = 1,
                RegionStartSeconds = 0.0,
                RegionEndSeconds = 10.0,
                RanAt = DateTimeOffset.UtcNow,
            },
        ];
    }

    private static LevelAnalysis BuildLevelWithCrestFactor(double crestFactorDb)
    {
        return new LevelAnalysis
        {
            Channels =
            [
                new ChannelLevelAnalysis
                {
                    ChannelId = "ch1",
                    ChannelName = "Mono",
                    Quantity = "digital_amplitude",
                    Unit = "FS",
                    Min = -0.5,
                    Max = 0.5,
                    Peak = 0.5,
                    Rms = 0.1,
                    DcOffset = 0.0,
                    CrestFactorDb = crestFactorDb,
                    CrestFactor = Math.Pow(10, crestFactorDb / 20.0),
                    IsCalibrated = false,
                },
            ],
        };
    }

    private static LevelAnalysis BuildLevelWithDcOffset(double dcOffset)
    {
        return new LevelAnalysis
        {
            Channels =
            [
                new ChannelLevelAnalysis
                {
                    ChannelId = "ch1",
                    ChannelName = "Mono",
                    Quantity = "digital_amplitude",
                    Unit = "FS",
                    Min = -0.5,
                    Max = 0.5,
                    Peak = 0.5,
                    Rms = 0.1,
                    DcOffset = dcOffset,
                    CrestFactorDb = 14.0,
                    CrestFactor = 5.0,
                    IsCalibrated = false,
                },
            ],
        };
    }

    private static LevelAnalysis BuildCleanLevel()
    {
        return new LevelAnalysis
        {
            Channels =
            [
                new ChannelLevelAnalysis
                {
                    ChannelId = "ch1",
                    ChannelName = "Mono",
                    Quantity = "digital_amplitude",
                    Unit = "FS",
                    Min = -0.3,
                    Max = 0.3,
                    Peak = 0.3,
                    Rms = 0.1,
                    DcOffset = 0.001,
                    CrestFactorDb = 9.5,
                    CrestFactor = 3.0,
                    IsCalibrated = false,
                },
            ],
        };
    }

    private static SpectrumAnalysis BuildSpectrumWithTonalPeak(double frequencyHz, double prominenceDb)
    {
        return new SpectrumAnalysis
        {
            Channels =
            [
                new ChannelSpectrumAnalysis
                {
                    ChannelId = "ch1",
                    ChannelName = "Mono",
                    Quantity = "digital_amplitude",
                    Unit = "FS",
                    FrequenciesHz = [frequencyHz],
                    Magnitudes = [0.1],
                    MagnitudesDb = [-20.0],
                    TonalPeaks =
                    [
                        new TonalPeak
                        {
                            FrequencyHz = frequencyHz,
                            MagnitudeDb = -20.0,
                            LocalFloorDb = -20.0 - prominenceDb,
                            ProminenceDb = prominenceDb,
                            BandwidthHz = 10.0,
                            Confidence = "high",
                            Method = "local_prominence",
                        },
                    ],
                },
            ],
            Parameters = new SpectrumParameters
            {
                FftSize = 8192,
                WindowType = "hann",
                Overlap = 0.5,
                Averaging = "power",
                Scaling = "one-sided amplitude",
                StartTimeSeconds = 0.0,
                EndTimeSeconds = 1.0,
                BlockCount = 1,
            },
            Region = new TimeRange
            {
                StartSeconds = 0.0,
                EndSeconds = 1.0,
                DurationSeconds = 1.0,
            },
        };
    }
}
