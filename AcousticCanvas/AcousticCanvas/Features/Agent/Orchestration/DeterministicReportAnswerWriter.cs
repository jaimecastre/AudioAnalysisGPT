namespace AcousticCanvas.Features.Agent.Orchestration;

public static class DeterministicReportAnswerWriter
{
    public const string ReportGeneratedAnswer =
        "I generated the QA report from deterministic backend analysis outputs. Open the report artifact for the full metrics, findings, limitations, and suggested next checks.";

    public static bool CanWrite(IReadOnlyList<ToolExecutionOutput> toolExecutionOutputs)
    {
        if (toolExecutionOutputs.Count == 0)
        {
            return false;
        }

        foreach (var output in toolExecutionOutputs)
        {
            if (
                output.ToolName != AgentToolNames.GenerateReport
                || output.Status != "completed"
            )
            {
                return false;
            }
        }

        return true;
    }

    public static FinalAnswerResponse Write()
    {
        return new FinalAnswerResponse
        {
            Answer = ReportGeneratedAnswer,
            EvidenceReferences = [],
            Confidence = "high",
            Limitations = [],
            SuggestedNextSteps = [],
        };
    }
}
