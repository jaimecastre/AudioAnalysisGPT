namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentVisualizationBlockBuilder
{
    public static IReadOnlyList<WorkflowBlock> BuildWorkflowBlocks(
        VisualizationPlan visualizationPlan,
        EvidencePackage evidencePackage
    )
    {
        var workflowBlocks = new List<WorkflowBlock>();

        foreach (var planBlock in visualizationPlan.Blocks)
        {
            if (planBlock.BlockType != VisualizationBlockTypes.Workflow)
            {
                continue;
            }

            if (planBlock.SourceEvidenceIds is null || planBlock.SourceEvidenceIds.Count < 3)
            {
                continue;
            }

            var steps = BuildWorkflowSteps(planBlock.SourceEvidenceIds, evidencePackage);
            if (steps.Count < 3)
            {
                continue;
            }

            workflowBlocks.Add(
                new WorkflowBlock
                {
                    Title = "Generated analysis workflow",
                    Question = evidencePackage.UserQuestion,
                    Steps = steps,
                }
            );
        }

        return workflowBlocks;
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

            var signals = BuildSpectrumOverlaySignals(planBlock.SourceEvidenceIds, evidencePackage);
            if (signals.Count < 2)
            {
                continue;
            }

            overlayBlocks.Add(
                new SpectrumOverlayBlock { Title = "Spectrum Comparison", Signals = signals }
            );
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

            var signals = BuildSoundQualitySignals(planBlock.SourceEvidenceIds, evidencePackage);
            if (signals.Count < 2)
            {
                continue;
            }

            comparisonBlocks.Add(
                new SoundQualityComparisonBlock
                {
                    Title = "Sound Quality Comparison",
                    Signals = signals,
                }
            );
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

            var signals = BuildInvestigationSignals(planBlock.SourceEvidenceIds, evidencePackage);
            if (signals.Count < 2)
            {
                continue;
            }

            investigationBlocks.Add(
                new InvestigationBlock
                {
                    DiagnosticQuestion = evidencePackage.UserQuestion,
                    Signals = signals,
                }
            );
        }

        return investigationBlocks;
    }

    private static List<WorkflowStep> BuildWorkflowSteps(
        IReadOnlyList<string> sourceEvidenceIds,
        EvidencePackage evidencePackage
    )
    {
        var steps = new List<WorkflowStep>();

        foreach (var evidenceId in sourceEvidenceIds)
        {
            if (!AgentEvidenceLookup.TryFindEvidence(evidencePackage, evidenceId, out var evidence))
            {
                continue;
            }

            var toolName = ExpertVisualizationPlanner.MapWorkflowToolName(evidence.Type);
            if (toolName is null)
            {
                continue;
            }

            AgentEvidenceLookup.TryGetResultId(evidence, out var resultId);
            var fileIdentity = AgentEvidenceLookup.GetEvidenceFileIdentity(
                evidence,
                evidenceId,
                string.IsNullOrWhiteSpace(resultId) ? evidenceId : resultId
            );

            steps.Add(
                new WorkflowStep
                {
                    StepNumber = steps.Count + 1,
                    ToolName = toolName,
                    EvidenceType = evidence.Type,
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    ResultId = string.IsNullOrWhiteSpace(resultId) ? null : resultId,
                    Description = BuildWorkflowStepDescription(evidence.Type),
                }
            );
        }

        return steps;
    }

    private static string BuildWorkflowStepDescription(string evidenceType)
    {
        return evidenceType switch
        {
            EvidenceTypes.Metadata => "Check file duration, sample rate, channels, and format metadata.",
            EvidenceTypes.BasicMetrics => "Measure peak, RMS, crest factor, and related level facts.",
            EvidenceTypes.EventDetection => "Detect clipping, silence, transients, or loudest regions.",
            EvidenceTypes.Spectrum => "Inspect frequency content, tonal peaks, and spectral balance.",
            EvidenceTypes.Spectrogram => "Inspect time-frequency structure across the recording.",
            EvidenceTypes.Cpb => "Summarize octave or third-octave band balance.",
            EvidenceTypes.SoundQuality => "Measure loudness, sharpness, and roughness.",
            EvidenceTypes.Findings => "Collect deterministic findings and severity-coded issues.",
            _ => "Collect structured evidence for the investigation.",
        };
    }

    private static List<OverlaySignal> BuildSpectrumOverlaySignals(
        IReadOnlyList<string> sourceEvidenceIds,
        EvidencePackage evidencePackage
    )
    {
        var signals = new List<OverlaySignal>();

        foreach (var evidenceId in sourceEvidenceIds)
        {
            if (
                !AgentEvidenceLookup.TryFindEvidence(evidencePackage, evidenceId, out var evidence)
                || !AgentEvidenceLookup.TryGetResultId(evidence, out var resultId)
            )
            {
                continue;
            }

            var fileIdentity = AgentEvidenceLookup.GetEvidenceFileIdentity(
                evidence,
                evidenceId,
                resultId
            );

            signals.Add(
                new OverlaySignal
                {
                    ResultId = resultId,
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    PlotHints = ExpertVisualizationPlanner.BuildPlotHintsFor(evidence),
                }
            );
        }

        return signals;
    }

    private static List<SoundQualitySignal> BuildSoundQualitySignals(
        IReadOnlyList<string> sourceEvidenceIds,
        EvidencePackage evidencePackage
    )
    {
        var signals = new List<SoundQualitySignal>();

        foreach (var evidenceId in sourceEvidenceIds)
        {
            if (!AgentEvidenceLookup.TryFindEvidence(evidencePackage, evidenceId, out var evidence))
            {
                continue;
            }

            if (
                !TryReadDouble(evidence, "loudnessSone", out var loudnessSone)
                || !TryReadDouble(evidence, "sharpnessAcum", out var sharpnessAcum)
                || !TryReadDouble(evidence, "roughnessAsper", out var roughnessAsper)
            )
            {
                continue;
            }

            var fileIdentity = AgentEvidenceLookup.GetEvidenceFileIdentity(
                evidence,
                evidenceId,
                evidenceId
            );

            signals.Add(
                new SoundQualitySignal
                {
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    LoudnessSone = loudnessSone,
                    SharpnessAcum = sharpnessAcum,
                    RoughnessAsper = roughnessAsper,
                }
            );
        }

        return signals;
    }

    private static List<InvestigationSignal> BuildInvestigationSignals(
        IReadOnlyList<string> sourceEvidenceIds,
        EvidencePackage evidencePackage
    )
    {
        var signals = new List<InvestigationSignal>();

        foreach (var evidenceId in sourceEvidenceIds)
        {
            if (
                !AgentEvidenceLookup.TryFindEvidence(evidencePackage, evidenceId, out var evidence)
                || !AgentEvidenceLookup.TryGetResultId(evidence, out var resultId)
            )
            {
                continue;
            }

            var viewType = ExpertVisualizationPlanner.MapViewType(evidence.Type);
            if (viewType is null)
            {
                continue;
            }

            var fileIdentity = AgentEvidenceLookup.GetEvidenceFileIdentity(
                evidence,
                evidenceId,
                resultId
            );

            signals.Add(
                new InvestigationSignal
                {
                    ResultId = resultId,
                    FileId = fileIdentity.FileId,
                    FileName = fileIdentity.FileName,
                    ViewType = viewType,
                    PlotHints = ExpertVisualizationPlanner.BuildPlotHintsFor(evidence),
                }
            );
        }

        return signals;
    }

    private static bool TryReadDouble(EvidenceItem evidence, string key, out double value)
    {
        if (evidence.Data.TryGetValue(key, out var rawValue) && rawValue is double doubleValue)
        {
            value = doubleValue;
            return true;
        }

        value = 0;
        return false;
    }
}
