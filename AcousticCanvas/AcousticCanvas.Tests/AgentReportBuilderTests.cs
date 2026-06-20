using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentReportBuilderTests
{
    [Fact]
    public void Build_IncludesDeterministicMeasurementsFindingsAndLimitations()
    {
        var evidencePackage = new EvidencePackage
        {
            EvidencePackageId = "ev_report",
            UserQuestion = "Generate a QA report",
            SelectedFileIds = ["file-a"],
            AnalysesRun =
            [
                AgentToolNames.GetMetadata,
                AgentToolNames.RunBasicMetrics,
                AgentToolNames.RunSoundQualityMetrics,
                AgentToolNames.RunFindings,
            ],
            KeyEvidence =
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_meta_file-a",
                    Type = EvidenceTypes.Metadata,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-a",
                        ["fileName"] = "fan.wav",
                        ["durationSeconds"] = 2.5,
                        ["sampleRateHz"] = 44100,
                        ["channels"] = 1,
                        ["bitDepth"] = 16,
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_metrics_file-a",
                    Type = EvidenceTypes.BasicMetrics,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-a",
                        ["fileName"] = "fan.wav",
                        ["rmsDbFs"] = -18.25,
                        ["peakDbFs"] = -3.5,
                        ["crestFactorDb"] = 14.75,
                        ["levelDbUnit"] = "dBFS",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_sq_file-a",
                    Type = EvidenceTypes.SoundQuality,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-a",
                        ["fileName"] = "fan.wav",
                        ["loudnessSone"] = 10.5,
                        ["sharpnessAcum"] = 1.25,
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_cpb_file-a",
                    Type = EvidenceTypes.Cpb,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-a",
                        ["fileName"] = "fan.wav",
                        ["highestBands"] = new List<object?>
                        {
                            new
                            {
                                centerFrequencyHz = 160.0,
                                levelDb = 69.03,
                                label = "160",
                            },
                        },
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_findings_file-a",
                    Type = EvidenceTypes.Findings,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-a",
                        ["fileName"] = "fan.wav",
                        ["findingCount"] = 1,
                        ["findings"] = new List<object?>
                        {
                            new
                            {
                                severity = "High",
                                title = "Digital clipping detected",
                                description = "Samples reached full scale.",
                                suggestedNextStep = "Inspect the clipped region.",
                                startSeconds = 0.25,
                                endSeconds = 0.50,
                            },
                        },
                    },
                },
            ],
            Limitations =
            [
                "Only digital clipping was assessed. Analog distortion is not detectable from the digital signal.",
            ],
        };

        var result = AgentReportBuilder.Build(
            "Acoustic QA Report",
            evidencePackage,
            ["metadata_123", "basic_metrics_456"]
        );

        Assert.Equal("Acoustic QA Report", result.Title);
        Assert.Equal(["metadata_123", "basic_metrics_456"], result.SourceToolResultRefs);
        Assert.Contains("# Acoustic QA Report", result.MarkdownContent);
        Assert.Contains("fan.wav", result.MarkdownContent);
        Assert.Contains("2.500 s", result.MarkdownContent);
        Assert.Contains("-18.25 dBFS", result.MarkdownContent);
        Assert.Contains("-3.50 dBFS", result.MarkdownContent);
        Assert.Contains("14.75 dB", result.MarkdownContent);
        Assert.Contains("10.50 sone", result.MarkdownContent);
        Assert.Contains("1.25 acum", result.MarkdownContent);
        Assert.Contains("Roughness: unavailable", result.MarkdownContent);
        Assert.Contains("160 (69.03 dB SPL)", result.MarkdownContent);
        Assert.DoesNotContain("160 (69.03 dBFS)", result.MarkdownContent);
        Assert.Contains("Digital clipping detected", result.MarkdownContent);
        Assert.Contains("relative/digital", result.MarkdownContent);
        Assert.Contains("Only digital clipping was assessed", result.MarkdownContent);
    }

    [Fact]
    public void Build_WhenMultipleFiles_IncludesCrossFileComparisonWithWinnersAndRanges()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "quiet.wav",
                    rmsDbFs: -24.0,
                    peakDbFs: -5.0,
                    loudnessSone: 5.0,
                    sharpnessAcum: 0.8,
                    roughnessAsper: 0.02,
                    findingCount: 0,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "loud.wav",
                    rmsDbFs: -12.5,
                    peakDbFs: -1.25,
                    loudnessSone: 11.25,
                    sharpnessAcum: 1.4,
                    roughnessAsper: 0.08,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "medium",
                            Title: "Prominent tonal peak",
                            Description: "A narrow peak was detected.",
                            SuggestedNextStep: "Inspect the peak.",
                            StartSeconds: 0,
                            EndSeconds: 1
                        ),
                    ]
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.Contains("## Cross-file Comparison", result.MarkdownContent);
        Assert.Contains("- Loudest by RMS: loud.wav (-12.50 dBFS)", result.MarkdownContent);
        Assert.Contains("- Highest peak: loud.wav (-1.25 dBFS)", result.MarkdownContent);
        Assert.Contains("- Loudest psychoacoustic file: loud.wav (11.25 sone)", result.MarkdownContent);
        Assert.Contains("- Sharpest file: loud.wav (1.40 acum)", result.MarkdownContent);
        Assert.Contains("- Roughest file: loud.wav (0.08 asper)", result.MarkdownContent);
        Assert.Contains("- RMS range: 11.50 dBFS from quiet.wav to loud.wav", result.MarkdownContent);
        Assert.Contains("- Peak range: 3.75 dBFS from quiet.wav to loud.wav", result.MarkdownContent);
        Assert.Contains("- Most findings: loud.wav (1)", result.MarkdownContent);
    }

    [Fact]
    public void Build_WhenMultipleFiles_IncludesBatchConclusionAfterCrossFileComparison()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "reference.wav",
                    rmsDbFs: -24.0,
                    peakDbFs: -8.0,
                    loudnessSone: 4.0,
                    sharpnessAcum: 0.6,
                    roughnessAsper: 0.01,
                    findingCount: 0,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "problem.wav",
                    rmsDbFs: -12.0,
                    peakDbFs: -1.0,
                    loudnessSone: 12.0,
                    sharpnessAcum: 1.5,
                    roughnessAsper: 0.08,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "medium",
                            Title: "Prominent tonal peak",
                            Description: "A narrow spectral peak at 908.1 Hz stands 20.5 dB above its local spectral floor.",
                            SuggestedNextStep: "Inspect the peak.",
                            StartSeconds: 0,
                            EndSeconds: 1
                        ),
                    ]
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        var crossFileIndex = result.MarkdownContent.IndexOf("## Cross-file Comparison", StringComparison.Ordinal);
        var batchConclusionIndex = result.MarkdownContent.IndexOf("## Batch Conclusion", StringComparison.Ordinal);
        var filesAnalyzedIndex = result.MarkdownContent.IndexOf("## Files Analyzed", StringComparison.Ordinal);

        Assert.True(crossFileIndex >= 0);
        Assert.True(batchConclusionIndex > crossFileIndex);
        Assert.True(filesAnalyzedIndex > batchConclusionIndex);
        Assert.Contains(
            "- Best candidate for this QA batch: reference.wav - no findings, lowest peak level, and quietest RMS level.",
            result.MarkdownContent
        );
        Assert.Contains(
            "- Needs most attention: problem.wav - medium finding, highest peak level, and loudest RMS level.",
            result.MarkdownContent
        );
    }

    [Fact]
    public void Build_WhenBatchConclusionTies_ListsAllTiedFiles()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "a.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "b.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.Contains("- Best candidate for this QA batch: a.wav, b.wav", result.MarkdownContent);
        Assert.Contains("- Needs most attention: a.wav, b.wav", result.MarkdownContent);
    }

    [Fact]
    public void Build_WhenSoundQualityMissing_BatchConclusionDoesNotMentionPsychoacousticReasons()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "quiet.wav",
                    rmsDbFs: -24.0,
                    peakDbFs: -8.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "loud.wav",
                    rmsDbFs: -12.0,
                    peakDbFs: -1.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);
        var batchConclusion = result.MarkdownContent[
            result.MarkdownContent.IndexOf("## Batch Conclusion", StringComparison.Ordinal)..
            result.MarkdownContent.IndexOf("## Files Analyzed", StringComparison.Ordinal)
        ];

        Assert.DoesNotContain("loudness", batchConclusion, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("sharp", batchConclusion, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rough", batchConclusion, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Build_WhenFindingCountsTie_ListsAllFilesWithTheTopFindingCount()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "a.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "b.wav",
                    rmsDbFs: -18.0,
                    peakDbFs: -3.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-c",
                    fileName: "c.wav",
                    rmsDbFs: -19.0,
                    peakDbFs: -5.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.Contains("- Most findings: a.wav, b.wav (1 each)", result.MarkdownContent);
        Assert.DoesNotContain("- Most findings: a.wav (1)", result.MarkdownContent);
    }

    [Fact]
    public void Build_WhenSoundQualityMissing_SkipsSoundQualityComparisonBullets()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "a.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "b.wav",
                    rmsDbFs: -18.0,
                    peakDbFs: -3.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.Contains("## Cross-file Comparison", result.MarkdownContent);
        Assert.DoesNotContain("Loudest psychoacoustic file", result.MarkdownContent);
        Assert.DoesNotContain("Sharpest file", result.MarkdownContent);
        Assert.DoesNotContain("Roughest file", result.MarkdownContent);
    }

    [Fact]
    public void Build_AttentionRequiredOrdersHighAndMediumFindingsBeforeLowFindings()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-low",
                    fileName: "low.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "low",
                            Title: "Minor tonal peak",
                            Description: "Low prominence peak.",
                            SuggestedNextStep: "Review if needed.",
                            StartSeconds: 0,
                            EndSeconds: 1
                        ),
                    ]
                ),
                BuildReportSource(
                    fileId: "file-high",
                    fileName: "high.wav",
                    rmsDbFs: -18.0,
                    peakDbFs: -2.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "high",
                            Title: "Clipping detected",
                            Description: "Samples reached full scale.",
                            SuggestedNextStep: "Inspect clipped region.",
                            StartSeconds: 0.25,
                            EndSeconds: 0.5
                        ),
                    ]
                ),
                BuildReportSource(
                    fileId: "file-medium",
                    fileName: "medium.wav",
                    rmsDbFs: -19.0,
                    peakDbFs: -3.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "medium",
                            Title: "Prominent tonal peak",
                            Description: "A narrow peak was detected.",
                            SuggestedNextStep: "Inspect the peak.",
                            StartSeconds: 0,
                            EndSeconds: 1
                        ),
                    ]
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.Contains("### Attention required", result.MarkdownContent);
        var highIndex = result.MarkdownContent.IndexOf("high.wav: high clipping detected", StringComparison.Ordinal);
        var mediumIndex = result.MarkdownContent.IndexOf("medium.wav: medium prominent tonal peak", StringComparison.Ordinal);
        var lowIndex = result.MarkdownContent.IndexOf("low.wav: low minor tonal peak", StringComparison.Ordinal);

        Assert.True(highIndex >= 0);
        Assert.True(mediumIndex > highIndex);
        Assert.True(lowIndex > mediumIndex);
        Assert.DoesNotContain("No file-level findings require immediate attention", result.MarkdownContent);
    }

    [Fact]
    public void Build_AttentionRequiredUsesConciseFindingSummaries()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "tone.wav",
                    rmsDbFs: -18.0,
                    peakDbFs: -2.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 1,
                    findings:
                    [
                        new ReportFindingSource(
                            Severity: "medium",
                            Title: "Prominent Tonal Peak",
                            Description: "A narrow spectral peak at 908.1 Hz stands 20.5 dB above its local spectral floor.",
                            SuggestedNextStep: "Inspect the spectrum around this frequency and compare it against a reference recording.",
                            StartSeconds: 0,
                            EndSeconds: 4
                        ),
                    ]
                ),
                BuildReportSource(
                    fileId: "file-b",
                    fileName: "reference.wav",
                    rmsDbFs: -20.0,
                    peakDbFs: -4.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);
        var attentionSection = result.MarkdownContent[
            result.MarkdownContent.IndexOf("### Attention required", StringComparison.Ordinal)..
            result.MarkdownContent.IndexOf("## Files Analyzed", StringComparison.Ordinal)
        ];

        Assert.Contains("- tone.wav: medium prominent tonal peak at 908.1 Hz (0.000 s to 4.000 s).", attentionSection);
        Assert.DoesNotContain("stands 20.5 dB above its local spectral floor", attentionSection);
        Assert.DoesNotContain("Next:", attentionSection);
        Assert.Contains("stands 20.5 dB above its local spectral floor", result.MarkdownContent);
        Assert.Contains("Next: Inspect the spectrum around this frequency", result.MarkdownContent);
    }

    [Fact]
    public void Build_WhenSingleFile_DoesNotIncludeCrossFileComparison()
    {
        var evidencePackage = BuildMultiFileEvidencePackage(
            [
                BuildReportSource(
                    fileId: "file-a",
                    fileName: "single.wav",
                    rmsDbFs: -18.0,
                    peakDbFs: -3.0,
                    loudnessSone: null,
                    sharpnessAcum: null,
                    roughnessAsper: null,
                    findingCount: 0,
                    findings: []
                ),
            ]
        );

        var result = AgentReportBuilder.Build("Acoustic QA Report", evidencePackage, []);

        Assert.DoesNotContain("## Cross-file Comparison", result.MarkdownContent);
        Assert.DoesNotContain("## Batch Conclusion", result.MarkdownContent);
    }

    private static EvidencePackage BuildMultiFileEvidencePackage(
        IReadOnlyList<ReportFileSource> sources
    )
    {
        var evidenceItems = new List<EvidenceItem>();
        foreach (var source in sources)
        {
            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = "ev_metrics_" + source.FileId,
                    Type = EvidenceTypes.BasicMetrics,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = source.FileId,
                        ["fileName"] = source.FileName,
                        ["rmsDbFs"] = source.RmsDbFs,
                        ["peakDbFs"] = source.PeakDbFs,
                        ["crestFactorDb"] = source.PeakDbFs - source.RmsDbFs,
                        ["levelDbUnit"] = "dBFS",
                    },
                }
            );

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = "ev_sound_quality_" + source.FileId,
                    Type = EvidenceTypes.SoundQuality,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = source.FileId,
                        ["fileName"] = source.FileName,
                        ["loudnessSone"] = source.LoudnessSone,
                        ["sharpnessAcum"] = source.SharpnessAcum,
                        ["roughnessAsper"] = source.RoughnessAsper,
                    },
                }
            );

            evidenceItems.Add(
                new EvidenceItem
                {
                    EvidenceId = "ev_findings_" + source.FileId,
                    Type = EvidenceTypes.Findings,
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = source.FileId,
                        ["fileName"] = source.FileName,
                        ["findingCount"] = source.FindingCount,
                        ["findings"] = source.Findings.Select(f => new
                        {
                            severity = f.Severity,
                            title = f.Title,
                            description = f.Description,
                            suggestedNextStep = f.SuggestedNextStep,
                            startSeconds = f.StartSeconds,
                            endSeconds = f.EndSeconds,
                        }).ToList(),
                    },
                }
            );
        }

        return new EvidencePackage
        {
            EvidencePackageId = "ev_report",
            UserQuestion = "Generate a QA report",
            SelectedFileIds = sources.Select(s => s.FileId).ToList(),
            AnalysesRun =
            [
                AgentToolNames.RunBasicMetrics,
                AgentToolNames.RunSoundQualityMetrics,
                AgentToolNames.RunFindings,
            ],
            KeyEvidence = evidenceItems,
            Limitations = [],
        };
    }

    private static ReportFileSource BuildReportSource(
        string fileId,
        string fileName,
        double rmsDbFs,
        double peakDbFs,
        double? loudnessSone,
        double? sharpnessAcum,
        double? roughnessAsper,
        int findingCount,
        IReadOnlyList<ReportFindingSource> findings
    )
    {
        return new ReportFileSource(
            FileId: fileId,
            FileName: fileName,
            RmsDbFs: rmsDbFs,
            PeakDbFs: peakDbFs,
            LoudnessSone: loudnessSone,
            SharpnessAcum: sharpnessAcum,
            RoughnessAsper: roughnessAsper,
            FindingCount: findingCount,
            Findings: findings
        );
    }

    private sealed record ReportFileSource(
        string FileId,
        string FileName,
        double RmsDbFs,
        double PeakDbFs,
        double? LoudnessSone,
        double? SharpnessAcum,
        double? RoughnessAsper,
        int FindingCount,
        IReadOnlyList<ReportFindingSource> Findings
    );

    private sealed record ReportFindingSource(
        string Severity,
        string Title,
        string Description,
        string SuggestedNextStep,
        double StartSeconds,
        double EndSeconds
    );
}
