using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class DeterministicAnswerWriterTests
{
    private static EvidencePackage BuildPackage(params EvidenceItem[] evidenceItems)
    {
        return new EvidencePackage
        {
            EvidencePackageId = "ev_test",
            UserQuestion = "test question",
            SelectedFileIds = ["file_1"],
            AnalysesRun = ["tool"],
            KeyEvidence = evidenceItems,
            Limitations = [],
        };
    }

    private static EvidenceItem BasicMetricsItem(double peak, double rms, double crest)
    {
        return new EvidenceItem
        {
            EvidenceId = "ev_metrics_file_1",
            Type = "basic_metrics",
            Data = new Dictionary<string, object?>
            {
                ["fileId"] = "file_1",
                ["fileName"] = "product_a.wav",
                ["peakDbFs"] = peak,
                ["rmsDbFs"] = rms,
                ["crestFactorDb"] = crest,
            },
        };
    }

    private static EvidenceItem MetadataItem(string fileName, double duration, int sampleRate, int channels, int bitDepth)
    {
        return new EvidenceItem
        {
            EvidenceId = "ev_meta_file_1",
            Type = "metadata",
            Data = new Dictionary<string, object?>
            {
                ["fileId"] = "file_1",
                ["fileName"] = fileName,
                ["durationSeconds"] = duration,
                ["sampleRateHz"] = sampleRate,
                ["channels"] = channels,
                ["bitDepth"] = bitDepth,
            },
        };
    }

    [Fact]
    public void WritesPeakLevelAnswerWithHighConfidence()
    {
        var plan = new DeterministicFactPlan { ToolName = "run_basic_metrics", RequestedFields = ["peak"] };
        var package = BuildPackage(BasicMetricsItem(peak: -8.627, rms: -12.82, crest: 4.20));

        var answer = DeterministicAnswerWriter.Write(plan, package);

        Assert.Contains("-8.63", answer.Answer);
        Assert.Contains("eak", answer.Answer);
        Assert.Equal("high", answer.Confidence);
        Assert.Contains("ev_metrics_file_1", answer.EvidenceReferences);
    }

    [Fact]
    public void WritesOnlyRequestedMetricField()
    {
        var plan = new DeterministicFactPlan { ToolName = "run_basic_metrics", RequestedFields = ["peak"] };
        var package = BuildPackage(BasicMetricsItem(peak: -8.627, rms: -12.82, crest: 4.20));

        var answer = DeterministicAnswerWriter.Write(plan, package);

        Assert.Contains("-8.63", answer.Answer);
        Assert.DoesNotContain("-12.82", answer.Answer);
    }

    [Fact]
    public void WritesSampleRateAnswer()
    {
        var plan = new DeterministicFactPlan { ToolName = "get_metadata", RequestedFields = ["sampleRate"] };
        var package = BuildPackage(MetadataItem("product_a.wav", duration: 3.0, sampleRate: 48000, channels: 1, bitDepth: 32));

        var answer = DeterministicAnswerWriter.Write(plan, package);

        Assert.Contains("48000", answer.Answer);
        Assert.Equal("high", answer.Confidence);
    }

    [Fact]
    public void WritesFullMetadataSummary()
    {
        var plan = new DeterministicFactPlan
        {
            ToolName = "get_metadata",
            RequestedFields = ["fileName", "duration", "sampleRate", "channels", "bitDepth"],
        };
        var package = BuildPackage(MetadataItem("product_a.wav", duration: 3.0, sampleRate: 48000, channels: 1, bitDepth: 32));

        var answer = DeterministicAnswerWriter.Write(plan, package);

        Assert.Contains("product_a.wav", answer.Answer);
        Assert.Contains("48000", answer.Answer);
        Assert.Contains("32", answer.Answer);
    }

    [Fact]
    public void ReturnsLowConfidenceWhenNoEvidenceAvailable()
    {
        var plan = new DeterministicFactPlan { ToolName = "run_basic_metrics", RequestedFields = ["peak"] };
        var package = BuildPackage();

        var answer = DeterministicAnswerWriter.Write(plan, package);

        Assert.False(string.IsNullOrWhiteSpace(answer.Answer));
        Assert.Equal("low", answer.Confidence);
        Assert.NotEmpty(answer.Limitations);
    }
}
