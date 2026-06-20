using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class DeterministicReportAnswerWriterTests
{
    [Fact]
    public void CanWrite_ReturnsTrueOnlyForCompletedGenerateReportOutputs()
    {
        var reportOutput = new ToolExecutionOutput
        {
            ToolName = AgentToolNames.GenerateReport,
            Status = "completed",
            ResultRef = "report_123",
            ResultData = new
            {
                title = "Acoustic QA Report",
                markdownContent = "# Acoustic QA Report",
            },
        };

        var metricsOutput = new ToolExecutionOutput
        {
            ToolName = AgentToolNames.RunBasicMetrics,
            Status = "completed",
            ResultRef = "basic_metrics_123",
            ResultData = new { },
        };

        var failedReportOutput = new ToolExecutionOutput
        {
            ToolName = AgentToolNames.GenerateReport,
            Status = "failed",
            ResultRef = "generate_report_failed",
            ResultData = null,
        };

        Assert.True(DeterministicReportAnswerWriter.CanWrite([reportOutput]));
        Assert.False(DeterministicReportAnswerWriter.CanWrite([]));
        Assert.False(DeterministicReportAnswerWriter.CanWrite([reportOutput, metricsOutput]));
        Assert.False(DeterministicReportAnswerWriter.CanWrite([failedReportOutput]));
    }

    [Fact]
    public void Write_ReturnsSafeArtifactDirectedAnswerWithoutQaPassClaims()
    {
        var answer = DeterministicReportAnswerWriter.Write();

        Assert.Equal(
            "I generated the QA report from deterministic backend analysis outputs. Open the report artifact for the full metrics, findings, limitations, and suggested next checks.",
            answer.Answer
        );
        Assert.Equal("high", answer.Confidence);
        Assert.Empty(answer.EvidenceReferences);
        Assert.Empty(answer.Limitations);
        Assert.Empty(answer.SuggestedNextSteps);
        Assert.DoesNotContain("successfully", answer.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("meets", answer.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("standards", answer.Answer, StringComparison.OrdinalIgnoreCase);
    }
}
