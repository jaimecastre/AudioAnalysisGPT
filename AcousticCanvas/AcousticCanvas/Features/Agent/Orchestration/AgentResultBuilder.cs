using System.Text.Json;
using AcousticCanvas.Features.Agent.Commands;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentResultBuilder
{
    private static readonly JsonSerializerOptions BlockJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static AgentAskResult BuildClarificationResult(string conversationId, string question)
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: question,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "low",
            Limitations: ["Clarification needed before analysis can run."],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null,
            InvestigationTrace: null,
            Blocks: null
        );
    }

    public static AgentAskResult BuildNoAnalysisResult(
        string conversationId,
        string userQuestion,
        string reason
    )
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: reason,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "low",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null,
            InvestigationTrace: null,
            Blocks: null
        );
    }

    public static AgentAskResult BuildNoToolConversationResult(
        string conversationId,
        string answer,
        InvestigationTrace investigationTrace
    )
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: answer,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "high",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: "Answered as an Agent behavior question; no audio analysis was needed.",
            InvestigationTrace: investigationTrace,
            Blocks: null
        );
    }

    public static IReadOnlyList<AgentResponseBlock>? BuildResponseBlocks(
        FinalAnswerResponse finalAnswer
    )
    {
        return BuildResponseBlocks(finalAnswer.Blocks);
    }

    public static IReadOnlyList<AgentResponseBlock>? BuildResponseBlocks(
        IReadOnlyList<JsonElement>? finalAnswerBlocks
    )
    {
        if (finalAnswerBlocks is null || finalAnswerBlocks.Count == 0)
        {
            return null;
        }

        var blocks = new List<AgentResponseBlock>();

        for (int i = 0; i < finalAnswerBlocks.Count; i++)
        {
            var block = AgentResponseBlockParser.Parse(finalAnswerBlocks[i]);
            if (block is not null)
            {
                blocks.Add(block);
            }
        }

        return blocks.Count > 0 ? blocks : null;
    }

    public static List<JsonElement>? PrependDeterministicBlocks(
        IReadOnlyList<AgentResponseBlock> deterministicBlocks,
        List<JsonElement>? existingBlocks
    )
    {
        if (deterministicBlocks.Count == 0)
        {
            return existingBlocks;
        }

        var blocks = new List<JsonElement>();
        foreach (var deterministicBlock in deterministicBlocks)
        {
            blocks.Add(
                JsonSerializer.SerializeToElement(
                    deterministicBlock,
                    deterministicBlock.GetType(),
                    BlockJsonOptions
                )
            );
        }

        if (existingBlocks is not null)
        {
            foreach (var existingBlock in existingBlocks)
            {
                blocks.Add(existingBlock);
            }
        }

        return blocks;
    }

    public static List<JsonElement>? SuppressBlocksCoveredByCombinedVisuals(
        List<JsonElement>? finalAnswerBlocks,
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        if (finalAnswerBlocks is null || finalAnswerBlocks.Count == 0)
        {
            return finalAnswerBlocks;
        }

        var coveredEvidenceIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var coveredResultIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var hasSpectrumOverlay = false;

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (
                planBlock.BlockType
                is not (
                    VisualizationBlockTypes.SpectrumOverlay
                    or VisualizationBlockTypes.SoundQualityComparison
                )
            )
            {
                continue;
            }

            if (planBlock.BlockType == VisualizationBlockTypes.SpectrumOverlay)
            {
                hasSpectrumOverlay = true;
            }

            if (planBlock.SourceEvidenceIds is null)
            {
                continue;
            }

            foreach (var evidenceId in planBlock.SourceEvidenceIds)
            {
                coveredEvidenceIds.Add(evidenceId);

                if (
                    AgentEvidenceLookup.TryFindEvidence(
                        evidencePackage,
                        evidenceId,
                        out var evidence
                    ) && AgentEvidenceLookup.TryGetResultId(evidence, out var resultId)
                )
                {
                    coveredResultIds.Add(resultId);
                }
            }
        }

        if (coveredEvidenceIds.Count == 0 && coveredResultIds.Count == 0 && !hasSpectrumOverlay)
        {
            return finalAnswerBlocks;
        }

        var filteredBlocks = new List<JsonElement>();
        foreach (var block in finalAnswerBlocks)
        {
            if (
                ShouldSuppressBlockCoveredByCombinedVisual(
                    block,
                    coveredEvidenceIds,
                    coveredResultIds,
                    hasSpectrumOverlay
                )
            )
            {
                continue;
            }

            filteredBlocks.Add(block);
        }

        return filteredBlocks.Count > 0 ? filteredBlocks : null;
    }

    private static bool ShouldSuppressBlockCoveredByCombinedVisual(
        JsonElement block,
        HashSet<string> coveredEvidenceIds,
        HashSet<string> coveredResultIds,
        bool hasSpectrumOverlay
    )
    {
        if (!block.TryGetProperty("blockType", out var blockTypeElement))
        {
            return false;
        }

        var blockType = blockTypeElement.GetString();
        if (blockType == VisualizationBlockTypes.SpectrumChart && hasSpectrumOverlay)
        {
            return true;
        }

        if (blockType != VisualizationBlockTypes.AnalysisView)
        {
            return false;
        }

        if (
            block.TryGetProperty("sourceEvidenceId", out var sourceEvidenceIdElement)
            && sourceEvidenceIdElement.GetString() is { Length: > 0 } sourceEvidenceId
            && coveredEvidenceIds.Contains(sourceEvidenceId)
        )
        {
            return true;
        }

        return block.TryGetProperty("resultId", out var resultIdElement)
            && resultIdElement.GetString() is { Length: > 0 } resultId
            && coveredResultIds.Contains(resultId);
    }

    public static IReadOnlyDictionary<string, PlotHints> BuildPlotHintsLookup(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var lookup = new Dictionary<string, PlotHints>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.PlotHints is null || planBlock.SourceEvidenceId is null)
            {
                continue;
            }

            if (
                !AgentEvidenceLookup.TryFindEvidence(
                    evidencePackage,
                    planBlock.SourceEvidenceId,
                    out var evidence
                ) || !AgentEvidenceLookup.TryGetResultId(evidence, out var resultId)
            )
            {
                continue;
            }

            lookup[resultId] = planBlock.PlotHints;
        }

        return lookup;
    }

    public static IReadOnlyList<AgentToolExecutionRecord> BuildToolExecutionRecords(
        List<ToolExecutionOutput> toolOutputs
    )
    {
        var records = new List<AgentToolExecutionRecord>();

        foreach (var output in toolOutputs)
        {
            records.Add(
                new AgentToolExecutionRecord(
                    ToolName: output.ToolName,
                    Status: output.Status,
                    ResultRef: output.Status == "completed" ? output.ResultRef : null,
                    ErrorCode: output.ErrorCode,
                    ErrorMessage: output.ErrorMessage
                )
            );
        }

        return records;
    }

    public static IReadOnlyDictionary<string, object>? BuildToolResultsData(
        IEnumerable<ToolExecutionOutput> toolOutputs
    )
    {
        var dict = new Dictionary<string, object>();

        foreach (var output in toolOutputs)
        {
            if (
                output.Status == "completed"
                && output.ResultData is not null
                && !string.IsNullOrEmpty(output.ResultRef)
            )
            {
                dict[output.ResultRef] = output.ResultData;
            }
        }

        return dict.Count > 0 ? dict : null;
    }

    public static IReadOnlyList<AgentEvidenceItem> BuildEvidenceItems(
        EvidencePackage evidencePackage
    )
    {
        var evidenceItems = new List<AgentEvidenceItem>();

        foreach (var item in evidencePackage.KeyEvidence)
        {
            evidenceItems.Add(
                new AgentEvidenceItem(EvidenceId: item.EvidenceId, Type: item.Type, Data: item.Data)
            );
        }

        return evidenceItems;
    }

    public static IReadOnlyList<PlannedToolTrace> BuildPlannedToolTraces(
        List<PlannerToolRequest> toolRequests
    )
    {
        var traces = new List<PlannedToolTrace>();

        foreach (var request in toolRequests)
        {
            traces.Add(new PlannedToolTrace(Name: request.Name, Arguments: request.Arguments));
        }

        return traces;
    }

    public static IReadOnlyList<ToolExecutionTrace> BuildToolExecutionTraces(
        List<ToolExecutionOutput> toolOutputs
    )
    {
        var traces = new List<ToolExecutionTrace>();

        foreach (var output in toolOutputs)
        {
            traces.Add(
                new ToolExecutionTrace(
                    Name: output.ToolName,
                    Status: output.Status,
                    StartedAtUtc: output.StartedAtUtc,
                    FinishedAtUtc: output.FinishedAtUtc,
                    ErrorMessage: output.ErrorMessage
                )
            );
        }

        return traces;
    }

    public static InvestigationTrace BuildInvestigationTrace(
        string conversationId,
        string question,
        InvestigationPath path,
        IReadOnlyList<PlannedToolTrace> plannedTools,
        IReadOnlyList<ToolExecutionTrace> toolExecutions,
        string finalAnswer,
        string confidence,
        VisualizationPlan? visualizationPlan = null
    )
    {
        return new InvestigationTrace(
            Question: question,
            ConversationId: conversationId,
            Path: path,
            PlannedTools: plannedTools,
            ToolExecutions: toolExecutions,
            FinalAnswer: finalAnswer,
            Confidence: confidence,
            TimestampUtc: DateTime.UtcNow,
            VisualizationPlan: BuildVisualizationPlanTrace(visualizationPlan)
        );
    }

    private static VisualizationPlanTrace? BuildVisualizationPlanTrace(
        VisualizationPlan? visualizationPlan
    )
    {
        if (visualizationPlan is null)
        {
            return null;
        }

        var blocks = new List<VisualizationPlanBlockTrace>();

        foreach (var block in visualizationPlan.Blocks)
        {
            blocks.Add(
                new VisualizationPlanBlockTrace(
                    BlockType: block.BlockType,
                    Reason: block.Reason,
                    ViewType: block.ViewType,
                    SourceEvidenceId: block.SourceEvidenceId
                )
            );
        }

        return new VisualizationPlanTrace(
            PrimaryEvidenceType: visualizationPlan.PrimaryEvidenceType,
            Blocks: blocks
        );
    }

    public static IReadOnlyList<string> MergeAndDeduplicate(
        IReadOnlyList<string> fromAgent,
        IReadOnlyList<string> fromEvidence
    )
    {
        var merged = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in fromAgent)
        {
            if (!string.IsNullOrWhiteSpace(item) && seen.Add(item))
            {
                merged.Add(item);
            }
        }

        foreach (var item in fromEvidence)
        {
            if (!string.IsNullOrWhiteSpace(item) && seen.Add(item))
            {
                merged.Add(item);
            }
        }

        return merged;
    }
}
