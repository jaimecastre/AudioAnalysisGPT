using System.Text.Json;
using AcousticCanvas.Features.Agent.Commands;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentResultBuilder
{
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
        if (finalAnswer.Blocks is null || finalAnswer.Blocks.Count == 0)
        {
            return null;
        }

        var blocks = new List<AgentResponseBlock>();

        for (int i = 0; i < finalAnswer.Blocks.Count; i++)
        {
            var block = AgentResponseBlockParser.Parse(finalAnswer.Blocks[i]);
            if (block is not null)
            {
                blocks.Add(block);
            }
        }

        return blocks.Count > 0 ? blocks : null;
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
                planBlock.BlockType is not (
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
                    TryFindEvidence(evidencePackage, evidenceId, out var evidence)
                    && TryGetResultId(evidence, out var resultId)
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
            if (ShouldSuppressBlockCoveredByCombinedVisual(block, coveredEvidenceIds, coveredResultIds, hasSpectrumOverlay))
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

    public static IReadOnlyList<SpectrumOverlayBlock> BuildSpectrumOverlayBlocks(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var overlayBlocks = new List<SpectrumOverlayBlock>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.BlockType != VisualizationBlockTypes.SpectrumOverlay)
            {
                continue;
            }

            if (planBlock.SourceEvidenceIds is null || planBlock.SourceEvidenceIds.Count < 2)
            {
                continue;
            }

            var signals = new List<OverlaySignal>();

            foreach (var evidenceId in planBlock.SourceEvidenceIds)
            {
                if (
                    !TryFindEvidence(evidencePackage, evidenceId, out var evidence)
                    || !TryGetResultId(evidence, out var resultId)
                )
                {
                    continue;
                }

                var fileIdentity = GetEvidenceFileIdentity(evidence, evidenceId, resultId);

                signals.Add(new OverlaySignal
                {
                    ResultId = resultId,
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    PlotHints = ExpertVisualizationPlanner.BuildPlotHintsFor(evidence),
                });
            }

            if (signals.Count < 2)
            {
                continue;
            }

            overlayBlocks.Add(new SpectrumOverlayBlock
            {
                Title = "Spectrum Comparison",
                Signals = signals,
            });
        }

        return overlayBlocks;
    }

    public static IReadOnlyList<SoundQualityComparisonBlock> BuildSoundQualityComparisonBlocks(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var comparisonBlocks = new List<SoundQualityComparisonBlock>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.BlockType != VisualizationBlockTypes.SoundQualityComparison)
            {
                continue;
            }

            if (planBlock.SourceEvidenceIds is null || planBlock.SourceEvidenceIds.Count < 2)
            {
                continue;
            }

            var signals = new List<SoundQualitySignal>();

            foreach (var evidenceId in planBlock.SourceEvidenceIds)
            {
                if (!TryFindEvidence(evidencePackage, evidenceId, out var evidence))
                {
                    continue;
                }

                if (!evidence.Data.TryGetValue("loudnessSone", out var loudnessRaw) || loudnessRaw is not double loudnessSone)
                {
                    continue;
                }

                if (!evidence.Data.TryGetValue("sharpnessAcum", out var sharpnessRaw) || sharpnessRaw is not double sharpnessAcum)
                {
                    continue;
                }

                if (!evidence.Data.TryGetValue("roughnessAsper", out var roughnessRaw) || roughnessRaw is not double roughnessAsper)
                {
                    continue;
                }

                var fileIdentity = GetEvidenceFileIdentity(evidence, evidenceId, evidenceId);

                signals.Add(new SoundQualitySignal
                {
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    LoudnessSone = loudnessSone,
                    SharpnessAcum = sharpnessAcum,
                    RoughnessAsper = roughnessAsper,
                });
            }

            if (signals.Count < 2)
            {
                continue;
            }

            comparisonBlocks.Add(new SoundQualityComparisonBlock
            {
                Title = "Sound Quality Comparison",
                Signals = signals,
            });
        }

        return comparisonBlocks;
    }

    public static IReadOnlyList<InvestigationBlock> BuildInvestigationBlocks(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var investigationBlocks = new List<InvestigationBlock>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.BlockType != VisualizationBlockTypes.Investigation)
            {
                continue;
            }

            if (planBlock.SourceEvidenceIds is null || planBlock.SourceEvidenceIds.Count < 2)
            {
                continue;
            }

            var signals = new List<InvestigationSignal>();

            foreach (var evidenceId in planBlock.SourceEvidenceIds)
            {
                if (
                    !TryFindEvidence(evidencePackage, evidenceId, out var evidence)
                    || !TryGetResultId(evidence, out var resultId)
                )
                {
                    continue;
                }

                var viewType = ExpertVisualizationPlanner.MapViewType(evidence.Type);
                if (viewType is null)
                {
                    continue;
                }

                var fileIdentity = GetEvidenceFileIdentity(evidence, evidenceId, resultId);

                signals.Add(new InvestigationSignal
                {
                    ResultId = resultId,
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    ViewType = viewType,
                    PlotHints = ExpertVisualizationPlanner.BuildPlotHintsFor(evidence),
                });
            }

            if (signals.Count < 2)
            {
                continue;
            }

            investigationBlocks.Add(new InvestigationBlock
            {
                DiagnosticQuestion = evidencePackage.UserQuestion,
                Signals = signals,
            });
        }

        return investigationBlocks;
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
                !TryFindEvidence(evidencePackage, planBlock.SourceEvidenceId, out var evidence)
                || !TryGetResultId(evidence, out var resultId)
            )
            {
                continue;
            }

            lookup[resultId] = planBlock.PlotHints;
        }

        return lookup;
    }

    private static bool TryFindEvidence(
        EvidencePackage evidencePackage,
        string evidenceId,
        out EvidenceItem evidence
    )
    {
        foreach (var item in evidencePackage.KeyEvidence)
        {
            if (string.Equals(item.EvidenceId, evidenceId, StringComparison.OrdinalIgnoreCase))
            {
                evidence = item;
                return true;
            }
        }

        evidence = null!;
        return false;
    }

    private static bool TryGetResultId(EvidenceItem evidence, out string resultId)
    {
        if (
            evidence.Data.TryGetValue("resultId", out var resultIdRaw)
            && resultIdRaw is string resultIdString
            && !string.IsNullOrWhiteSpace(resultIdString)
        )
        {
            resultId = resultIdString;
            return true;
        }

        resultId = string.Empty;
        return false;
    }

    private static EvidenceFileIdentity GetEvidenceFileIdentity(
        EvidenceItem evidence,
        string fallbackFileId,
        string fallbackFileName
    )
    {
        evidence.Data.TryGetValue("fileId", out var fileIdRaw);
        evidence.Data.TryGetValue("fileName", out var fileNameRaw);

        return new EvidenceFileIdentity(
            FileId: fileIdRaw as string ?? fallbackFileId,
            FileName: fileNameRaw as string ?? fallbackFileName
        );
    }

    private sealed record EvidenceFileIdentity(string FileId, string FileName);

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
