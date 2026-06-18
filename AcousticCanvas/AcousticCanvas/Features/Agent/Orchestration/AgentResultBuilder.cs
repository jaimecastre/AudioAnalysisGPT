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
            var block = ParseBlock(finalAnswer.Blocks[i]);
            if (block is not null)
            {
                blocks.Add(block);
            }
        }

        return blocks.Count > 0 ? blocks : null;
    }

    public static IReadOnlyList<SpectrumOverlayBlock> BuildSpectrumOverlayBlocks(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var overlayBlocks = new List<SpectrumOverlayBlock>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.BlockType != "spectrumOverlay")
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
                var evidence = evidencePackage.KeyEvidence.FirstOrDefault(
                    item => item.EvidenceId == evidenceId
                );

                if (evidence is null)
                {
                    continue;
                }

                if (!evidence.Data.TryGetValue("resultId", out var resultIdRaw))
                {
                    continue;
                }

                if (resultIdRaw is not string resultId || string.IsNullOrWhiteSpace(resultId))
                {
                    continue;
                }

                evidence.Data.TryGetValue("fileId", out var fileIdRaw);
                evidence.Data.TryGetValue("fileName", out var fileNameRaw);

                signals.Add(new OverlaySignal
                {
                    ResultId = resultId,
                    FileId = fileIdRaw as string ?? evidenceId,
                    FileName = fileNameRaw as string ?? resultId,
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
            if (planBlock.BlockType != "soundQualityComparison")
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
                var evidence = evidencePackage.KeyEvidence.FirstOrDefault(
                    item => item.EvidenceId == evidenceId
                );

                if (evidence is null)
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

                evidence.Data.TryGetValue("fileId", out var fileIdRaw);
                evidence.Data.TryGetValue("fileName", out var fileNameRaw);

                signals.Add(new SoundQualitySignal
                {
                    FileId = fileIdRaw as string ?? evidenceId,
                    FileName = fileNameRaw as string ?? evidenceId,
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
            if (planBlock.BlockType != "investigation")
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
                var evidence = evidencePackage.KeyEvidence.FirstOrDefault(
                    item => item.EvidenceId == evidenceId
                );

                if (evidence is null)
                {
                    continue;
                }

                if (!evidence.Data.TryGetValue("resultId", out var resultIdRaw))
                {
                    continue;
                }

                if (resultIdRaw is not string resultId || string.IsNullOrWhiteSpace(resultId))
                {
                    continue;
                }

                var viewType = ExpertVisualizationPlanner.MapViewType(evidence.Type);
                if (viewType is null)
                {
                    continue;
                }

                evidence.Data.TryGetValue("fileId", out var fileIdRaw);
                evidence.Data.TryGetValue("fileName", out var fileNameRaw);

                signals.Add(new InvestigationSignal
                {
                    ResultId = resultId,
                    FileId = fileIdRaw as string ?? evidenceId,
                    FileName = fileNameRaw as string ?? resultId,
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

            var matchingEvidence = evidencePackage.KeyEvidence.FirstOrDefault(
                item => item.EvidenceId == planBlock.SourceEvidenceId
            );

            if (matchingEvidence is null)
            {
                continue;
            }

            if (!matchingEvidence.Data.TryGetValue("resultId", out var resultIdRaw))
            {
                continue;
            }

            if (resultIdRaw is not string resultId || string.IsNullOrWhiteSpace(resultId))
            {
                continue;
            }

            lookup[resultId] = planBlock.PlotHints;
        }

        return lookup;
    }

    private static AgentResponseBlock? ParseBlock(JsonElement element)
    {
        if (!element.TryGetProperty("blockType", out var blockTypeElement))
        {
            return null;
        }

        var blockType = blockTypeElement.GetString();

        return blockType switch
        {
            "markdown" => ParseMarkdownBlock(element),
            "statistics" => ParseStatisticsBlock(element),
            "spectrumChart" => ParseSpectrumChartBlock(element),
            "ranking" => ParseRankingBlock(element),
            "suggestedActions" => ParseSuggestedActionsBlock(element),
            "analysisView" => ParseAnalysisViewBlock(element),
            _ => null,
        };
    }

    private static MarkdownBlock? ParseMarkdownBlock(JsonElement element)
    {
        if (!element.TryGetProperty("content", out var contentElement))
            return null;

        return new MarkdownBlock { Content = contentElement.GetString() ?? string.Empty };
    }

    private static StatisticsBlock? ParseStatisticsBlock(JsonElement element)
    {
        if (!element.TryGetProperty("title", out var titleElement))
            return null;
        if (!element.TryGetProperty("rows", out var rowsElement))
            return null;

        var rows = new List<StatisticRow>();
        foreach (var row in rowsElement.EnumerateArray())
        {
            var label = row.TryGetProperty("label", out var labelEl)
                ? labelEl.GetString() ?? ""
                : "";
            var value = row.TryGetProperty("value", out var valueEl)
                ? valueEl.GetString() ?? ""
                : "";
            var unit = row.TryGetProperty("unit", out var unitEl) ? unitEl.GetString() : null;
            rows.Add(
                new StatisticRow
                {
                    Label = label,
                    Value = value,
                    Unit = unit,
                }
            );
        }

        return new StatisticsBlock
        {
            Title = titleElement.GetString() ?? string.Empty,
            Rows = rows,
        };
    }

    private static SpectrumChartBlock? ParseSpectrumChartBlock(JsonElement element)
    {
        if (
            !element.TryGetProperty("fileId", out var fileIdEl)
            || !element.TryGetProperty("fileName", out var fileNameEl)
            || !element.TryGetProperty("frequenciesHz", out var freqEl)
            || !element.TryGetProperty("magnitudesDb", out var magEl)
        )
        {
            return null;
        }

        var frequencies = freqEl.EnumerateArray().Select(f => f.GetDouble()).ToList();
        var magnitudes = magEl.EnumerateArray().Select(m => m.GetDouble()).ToList();
        var peakFreq = element.TryGetProperty("peakFrequencyHz", out var peakEl)
            ? peakEl.GetDouble()
            : (double?)null;

        var metadata = new ChartMetadata();
        if (element.TryGetProperty("metadata", out var metaEl))
        {
            if (metaEl.TryGetProperty("sourceTool", out var srcEl))
                metadata = metadata with { SourceTool = srcEl.GetString() };
            if (metaEl.TryGetProperty("fftSize", out var fftEl))
                metadata = metadata with { FftSize = fftEl.GetInt32() };
            if (metaEl.TryGetProperty("windowType", out var winEl))
                metadata = metadata with { WindowType = winEl.GetString() };
            if (metaEl.TryGetProperty("scaling", out var scaleEl))
                metadata = metadata with { Scaling = scaleEl.GetString() };
        }

        return new SpectrumChartBlock
        {
            FileId = fileIdEl.GetString() ?? string.Empty,
            FileName = fileNameEl.GetString() ?? string.Empty,
            FrequenciesHz = frequencies,
            MagnitudesDb = magnitudes,
            PeakFrequencyHz = peakFreq,
            Metadata = metadata,
        };
    }

    private static RankingBlock? ParseRankingBlock(JsonElement element)
    {
        if (
            !element.TryGetProperty("title", out var titleEl)
            || !element.TryGetProperty("metricName", out var metricEl)
            || !element.TryGetProperty("rankedItems", out var itemsEl)
        )
        {
            return null;
        }

        var items = new List<RankedItem>();
        foreach (var item in itemsEl.EnumerateArray())
        {
            if (
                !item.TryGetProperty("rank", out var rankEl)
                || !item.TryGetProperty("fileId", out var fileIdEl)
                || !item.TryGetProperty("fileName", out var fileNameEl)
                || !item.TryGetProperty("score", out var scoreEl)
                || !item.TryGetProperty("scoreLabel", out var scoreLabelEl)
            )
            {
                continue;
            }

            items.Add(
                new RankedItem
                {
                    Rank = rankEl.GetInt32(),
                    FileId = fileIdEl.GetString() ?? string.Empty,
                    FileName = fileNameEl.GetString() ?? string.Empty,
                    Score = scoreEl.GetDouble(),
                    ScoreLabel = scoreLabelEl.GetString() ?? string.Empty,
                    ScoreUnit = item.TryGetProperty("scoreUnit", out var unitEl)
                        ? unitEl.GetString()
                        : null,
                }
            );
        }

        return new RankingBlock
        {
            Title = titleEl.GetString() ?? string.Empty,
            MetricName = metricEl.GetString() ?? string.Empty,
            RankedItems = items,
        };
    }

    private static SuggestedActionsBlock? ParseSuggestedActionsBlock(JsonElement element)
    {
        if (!element.TryGetProperty("actions", out var actionsEl))
            return null;

        var actions = new List<SuggestedAction>();
        foreach (var action in actionsEl.EnumerateArray())
        {
            if (
                !action.TryGetProperty("label", out var labelEl)
                || !action.TryGetProperty("actionType", out var typeEl)
            )
            {
                continue;
            }

            actions.Add(
                new SuggestedAction
                {
                    Label = labelEl.GetString() ?? string.Empty,
                    ActionType = typeEl.GetString() ?? string.Empty,
                    ToolName = action.TryGetProperty("toolName", out var toolEl)
                        ? toolEl.GetString()
                        : null,
                    PromptText = action.TryGetProperty("promptText", out var promptEl)
                        ? promptEl.GetString()
                        : null,
                }
            );
        }

        return new SuggestedActionsBlock { Actions = actions };
    }

    private static AnalysisViewBlock? ParseAnalysisViewBlock(JsonElement element)
    {
        if (
            !element.TryGetProperty("viewType", out var viewTypeEl)
            || !element.TryGetProperty("resultId", out var resultIdEl)
            || !element.TryGetProperty("fileId", out var fileIdEl)
            || !element.TryGetProperty("fileName", out var fileNameEl)
            || !element.TryGetProperty("summary", out var summaryEl)
        )
        {
            return null;
        }

        var resultId = resultIdEl.GetString() ?? string.Empty;
        if (!System.Text.RegularExpressions.Regex.IsMatch(resultId, @"^[a-z]+_[0-9a-f]{32}$"))
        {
            return null;
        }

        var summary = ParseCompactSummary(summaryEl);
        var preview = element.TryGetProperty("preview", out var previewEl)
            ? ParseAnalysisPreview(previewEl)
            : null;

        return new AnalysisViewBlock
        {
            ViewType = viewTypeEl.GetString() ?? string.Empty,
            ResultId = resultId,
            FileId = fileIdEl.GetString() ?? string.Empty,
            FileName = fileNameEl.GetString() ?? string.Empty,
            Summary = summary,
            Title = element.TryGetProperty("title", out var titleEl) ? titleEl.GetString() : null,
            Preview = preview,
        };
    }

    private static AnalysisPreview? ParseAnalysisPreview(JsonElement element)
    {
        double[]? frequenciesHz = null;
        double[]? magnitudesDb = null;

        if (
            element.TryGetProperty("frequenciesHz", out var freqEl)
            && freqEl.ValueKind == JsonValueKind.Array
        )
        {
            frequenciesHz = freqEl.EnumerateArray().Select(e => e.GetDouble()).ToArray();
        }

        if (
            element.TryGetProperty("magnitudesDb", out var magEl)
            && magEl.ValueKind == JsonValueKind.Array
        )
        {
            magnitudesDb = magEl.EnumerateArray().Select(e => e.GetDouble()).ToArray();
        }

        if (frequenciesHz == null || magnitudesDb == null)
            return null;

        return new AnalysisPreview { FrequenciesHz = frequenciesHz, MagnitudesDb = magnitudesDb };
    }

    private static CompactSummary ParseCompactSummary(JsonElement element)
    {
        var summary = new CompactSummary();

        if (element.TryGetProperty("primaryMetric", out var primaryEl))
            summary = summary with { PrimaryMetric = primaryEl.GetString() };

        if (element.TryGetProperty("statusText", out var statusTextEl))
            summary = summary with { StatusText = statusTextEl.GetString() };

        if (element.TryGetProperty("statusIndicator", out var indicatorEl))
            summary = summary with { StatusIndicator = indicatorEl.GetString() };

        if (element.TryGetProperty("secondaryMetrics", out var metricsEl))
        {
            var metrics = new List<MetricItem>();
            foreach (var metric in metricsEl.EnumerateArray())
            {
                if (
                    metric.TryGetProperty("label", out var labelEl)
                    && metric.TryGetProperty("value", out var valueEl)
                )
                {
                    metrics.Add(
                        new MetricItem
                        {
                            Label = labelEl.GetString() ?? string.Empty,
                            Value = valueEl.GetString() ?? string.Empty,
                            Unit = metric.TryGetProperty("unit", out var unitEl)
                                ? unitEl.GetString()
                                : null,
                        }
                    );
                }
            }
            summary = summary with { SecondaryMetrics = metrics };
        }

        return summary;
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
