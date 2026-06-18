using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests.AgentEvaluation;

public sealed class AgentAnswerEvaluatorTests
{
    [Fact]
    public void PassesWhenAnswerUsesExistingEvidenceAndMeasuredValues()
    {
        var evidencePackage = BuildEvidencePackage(
            new EvidenceItem
            {
                EvidenceId = "ev_basic_file1",
                Type = "basic_metrics",
                Data = new Dictionary<string, object?>
                {
                    ["fileName"] = "motor.wav",
                    ["peakDbFs"] = 83.91,
                    ["rmsDbFs"] = 72.40,
                },
            }
        );
        var finalAnswer = new FinalAnswerResponse
        {
            Answer = "motor.wav peaks at 83.91 dB SPL and has RMS level 72.40 dB SPL.",
            EvidenceReferences = ["ev_basic_file1"],
            Confidence = "high",
            Limitations = [],
            SuggestedNextSteps = [],
        };
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "grounded_basic_metrics",
            Question = "What is the peak level?",
            EvidencePackage = evidencePackage,
            FinalAnswer = finalAnswer,
            ExpectedEvidenceRefs = ["ev_basic_file1"],
            MustContain = ["83.91 dB SPL"],
            RequiredUnits = ["dB SPL"],
            ExpectedConfidence = "high",
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.True(result.Passed, string.Join("\n", result.Failures));
        Assert.Empty(result.Failures);
    }

    [Fact]
    public void FailsWhenAnswerReferencesMissingEvidenceId()
    {
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "missing_evidence_ref",
            Question = "What is the peak level?",
            EvidencePackage = BuildEvidencePackage(),
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "Peak level is 83.91 dB SPL.",
                EvidenceReferences = ["ev_missing"],
                Confidence = "high",
            },
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("unknown evidence ID"));
    }

    [Fact]
    public void FailsWhenAnswerInventsNumericMeasurement()
    {
        var evidencePackage = BuildEvidencePackage(
            new EvidenceItem
            {
                EvidenceId = "ev_spectrum_file1",
                Type = "spectrum",
                Data = new Dictionary<string, object?>
                {
                    ["fileName"] = "tone.wav",
                    ["peakFrequencyHz"] = 1000.0,
                },
            }
        );
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "invented_frequency",
            Question = "What is the peak frequency?",
            EvidencePackage = evidencePackage,
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "The dominant tone is at 1200 Hz.",
                EvidenceReferences = ["ev_spectrum_file1"],
                Confidence = "high",
            },
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("1200 Hz"));
    }

    [Fact]
    public void FailsWhenEvidenceLimitationsAreOmitted()
    {
        var evidencePackage = BuildEvidencePackage(
            limitations:
            [
                "CPB analysis uses FFT-bin power summation (nominal approximation, not IEC 61260 filter-bank).",
            ]
        );
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "missing_limitation",
            Question = "Is this IEC compliant?",
            EvidencePackage = evidencePackage,
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "The CPB result shows the band balance.",
                EvidenceReferences = [],
                Confidence = "medium",
                Limitations = [],
            },
            ExpectedLimitations = ["FFT-bin power summation"],
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("limitation"));
    }

    [Fact]
    public void FailsWhenConfidenceIsHigherThanExpected()
    {
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "confidence_too_high",
            Question = "What caused this tone?",
            EvidencePackage = BuildEvidencePackage(),
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "The cause is unknown from the available evidence.",
                EvidenceReferences = [],
                Confidence = "high",
            },
            ExpectedConfidence = "low",
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("confidence"));
    }

    [Fact]
    public void FailsWhenAnswerClaimsUnsupportedCausality()
    {
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "unsupported_cause",
            Question = "What causes this tone?",
            EvidencePackage = BuildEvidencePackage(
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["peakFrequencyHz"] = 1000.0,
                    },
                }
            ),
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "The 1000 Hz tone is caused by a motor bearing fault.",
                EvidenceReferences = ["ev_spectrum_file1"],
                Confidence = "high",
            },
            ForbiddenClaims = ["motor bearing fault"],
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("forbidden claim"));
    }

    [Fact]
    public void FailsPlannerFallbackResponseForGraphRequest()
    {
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "planner_fallback_graph",
            Question = "show me some graphs",
            EvidencePackage = BuildEvidencePackage(
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["peakFrequencyHz"] = 1000.0,
                    },
                }
            ),
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "Planner returned an unparseable response. Falling back to no-tool mode.",
                EvidenceReferences = [],
                Confidence = "low",
            },
            ExpectedEvidenceRefs = ["ev_spectrum_file1"],
            MustNotContain = ["Planner returned an unparseable response"],
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("Planner returned"));
    }

    [Fact]
    public void FailsUnsupportedSoundQualityConversion()
    {
        var evalCase = new AgentAnswerEvalCase
        {
            Id = "sone_to_lufs_conversion",
            Question = "What LUFS is implied by 10 sone?",
            EvidencePackage = BuildEvidencePackage(
                new EvidenceItem
                {
                    EvidenceId = "ev_sound_quality_file1",
                    Type = "sound_quality",
                    Data = new Dictionary<string, object?>
                    {
                        ["loudnessSone"] = 10.0,
                    },
                }
            ),
            FinalAnswer = new FinalAnswerResponse
            {
                Answer = "10 sone implies -18 LUFS.",
                EvidenceReferences = ["ev_sound_quality_file1"],
                Confidence = "high",
            },
            ForbiddenClaims = ["implies -18 LUFS"],
        };

        var result = AgentAnswerEvaluator.Evaluate(evalCase);

        Assert.False(result.Passed);
        Assert.Contains(result.Failures, failure => failure.Contains("LUFS"));
    }

    private static EvidencePackage BuildEvidencePackage(
        params EvidenceItem[] evidenceItems
    )
    {
        return BuildEvidencePackage(evidenceItems, []);
    }

    private static EvidencePackage BuildEvidencePackage(
        IReadOnlyList<EvidenceItem>? evidenceItems = null,
        IReadOnlyList<string>? limitations = null
    )
    {
        return new EvidencePackage
        {
            EvidencePackageId = "ev_pkg_test",
            UserQuestion = "test question",
            SelectedFileIds = ["file1"],
            AnalysesRun = ["run_basic_metrics"],
            KeyEvidence = evidenceItems ?? [],
            Limitations = limitations ?? [],
        };
    }
}
