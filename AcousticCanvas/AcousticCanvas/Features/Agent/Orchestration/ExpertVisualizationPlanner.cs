namespace AcousticCanvas.Features.Agent.Orchestration;

public static class ExpertVisualizationPlanner
{
    public static VisualizationPlan Plan(EvidencePackage evidencePackage)
    {
        var blocks = new List<VisualizationPlanBlock>
        {
            new()
            {
                BlockType = "markdown",
                Reason =
                    evidencePackage.KeyEvidence.Count == 0
                        ? "Use text to answer a method or context question without inventing measured values."
                        : "Use text to summarize measured evidence and limitations.",
            },
        };

        AddSoundQualityComparisonBlockWhenUseful(evidencePackage, blocks);
        AddSpectrumOverlayBlockWhenUseful(evidencePackage, blocks);
        AddInvestigationBlockWhenUseful(evidencePackage, blocks);
        AddEvidenceViewBlocks(evidencePackage, blocks, BuildCoveredComparisonEvidenceIds(blocks));
        AddRankingBlockWhenUseful(evidencePackage, blocks);

        var primaryEvidenceType = DeterminePrimaryEvidenceType(evidencePackage);

        return new VisualizationPlan { PrimaryEvidenceType = primaryEvidenceType, Blocks = blocks };
    }

    private static void AddEvidenceViewBlocks(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks,
        HashSet<string> coveredComparisonEvidenceIds
    )
    {
        foreach (var evidenceItem in evidencePackage.KeyEvidence)
        {
            if (coveredComparisonEvidenceIds.Contains(evidenceItem.EvidenceId))
            {
                continue;
            }

            var viewType = MapEvidenceTypeToViewType(evidenceItem.Type);
            if (viewType is null)
            {
                continue;
            }

            if (!HasResultId(evidenceItem))
            {
                continue;
            }

            var plotHints = BuildPlotHintsFor(evidenceItem);

            blocks.Add(
                new VisualizationPlanBlock
                {
                    BlockType = "analysisView",
                    ViewType = viewType,
                    SourceEvidenceId = evidenceItem.EvidenceId,
                    Reason =
                        $"Show the {viewType} result in the trusted analysis view so the user can inspect measured data and metadata.",
                    PlotHints = plotHints,
                }
            );
        }
    }

    private static HashSet<string> BuildCoveredComparisonEvidenceIds(
        IReadOnlyList<VisualizationPlanBlock> blocks
    )
    {
        var coveredEvidenceIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var block in blocks)
        {
            if (block.BlockType is not ("spectrumOverlay" or "soundQualityComparison"))
            {
                continue;
            }

            if (block.SourceEvidenceIds is null)
            {
                continue;
            }

            foreach (var sourceEvidenceId in block.SourceEvidenceIds)
            {
                coveredEvidenceIds.Add(sourceEvidenceId);
            }
        }

        return coveredEvidenceIds;
    }

    private static void AddInvestigationBlockWhenUseful(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks
    )
    {
        var viewableItems = evidencePackage.KeyEvidence
            .Where(item => MapEvidenceTypeToViewType(item.Type) is not null && HasResultId(item))
            .ToList();

        var distinctViewTypes = viewableItems
            .Select(item => MapEvidenceTypeToViewType(item.Type)!)
            .Distinct()
            .ToList();

        if (distinctViewTypes.Count < 2)
        {
            return;
        }

        var sourceIds = viewableItems.Select(item => item.EvidenceId).ToList();

        blocks.Add(
            new VisualizationPlanBlock
            {
                BlockType = "investigation",
                SourceEvidenceId = sourceIds[0],
                SourceEvidenceIds = sourceIds,
                Reason =
                    $"Group {distinctViewTypes.Count} different analysis types ({string.Join(", ", distinctViewTypes)}) into one investigation card so the diagnostic picture is immediately clear.",
            }
        );
    }

    private static void AddSoundQualityComparisonBlockWhenUseful(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks
    )
    {
        var soundQualityItems = evidencePackage.KeyEvidence
            .Where(item => item.Type == "sound_quality")
            .ToList();

        if (soundQualityItems.Count < 2)
        {
            return;
        }

        var sourceIds = soundQualityItems.Select(item => item.EvidenceId).ToList();

        blocks.Add(
            new VisualizationPlanBlock
            {
                BlockType = "soundQualityComparison",
                SourceEvidenceId = sourceIds[0],
                SourceEvidenceIds = sourceIds,
                Reason =
                    $"Show loudness, sharpness, and roughness bars for {soundQualityItems.Count} files side-by-side so perceptual differences are immediately visible.",
            }
        );
    }

    private static void AddSpectrumOverlayBlockWhenUseful(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks
    )
    {
        var spectrumItems = evidencePackage.KeyEvidence
            .Where(item => item.Type == "spectrum" && HasResultId(item))
            .ToList();

        if (spectrumItems.Count < 2)
        {
            return;
        }

        var sourceIds = spectrumItems.Select(item => item.EvidenceId).ToList();

        blocks.Add(
            new VisualizationPlanBlock
            {
                BlockType = "spectrumOverlay",
                SourceEvidenceId = sourceIds[0],
                SourceEvidenceIds = sourceIds,
                Reason =
                    $"Overlay {spectrumItems.Count} spectrum results in one chart so differences in tonal balance, peaks, and frequency content are immediately visible.",
            }
        );
    }

    private static void AddRankingBlockWhenUseful(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks
    )
    {
        if (evidencePackage.SelectedFileIds.Count < 2)
        {
            return;
        }

        var normalizedQuestion = evidencePackage.UserQuestion.ToLowerInvariant();
        var asksForComparison =
            normalizedQuestion.Contains("which", StringComparison.Ordinal)
            || normalizedQuestion.Contains("compare", StringComparison.Ordinal)
            || normalizedQuestion.Contains("ranking", StringComparison.Ordinal)
            || normalizedQuestion.Contains("rank", StringComparison.Ordinal)
            || normalizedQuestion.Contains("worse", StringComparison.Ordinal)
            || normalizedQuestion.Contains("better", StringComparison.Ordinal)
            || normalizedQuestion.Contains("harsher", StringComparison.Ordinal)
            || normalizedQuestion.Contains("louder", StringComparison.Ordinal);

        if (!asksForComparison)
        {
            return;
        }

        var rankableEvidence = evidencePackage.KeyEvidence.FirstOrDefault(item =>
            item.Type is "sound_quality" or "basic_metrics" or "findings"
        );
        if (rankableEvidence is null)
        {
            return;
        }

        blocks.Add(
            new VisualizationPlanBlock
            {
                BlockType = "ranking",
                SourceEvidenceId = rankableEvidence.EvidenceId,
                Reason =
                    "Compare multiple files with a ranking block before the narrative so differences can be scanned quickly.",
            }
        );
    }

    private static string DeterminePrimaryEvidenceType(EvidencePackage evidencePackage)
    {
        if (evidencePackage.KeyEvidence.Count == 0)
        {
            return "method_or_context_answer";
        }

        if (evidencePackage.KeyEvidence.Any(item => item.Type == "sound_quality"))
        {
            return "sound_quality";
        }

        if (evidencePackage.KeyEvidence.Any(item => item.Type == "findings"))
        {
            return "findings";
        }

        return evidencePackage.KeyEvidence[0].Type;
    }

    public static string? MapViewType(string evidenceType) => MapEvidenceTypeToViewType(evidenceType);

    private static string? MapEvidenceTypeToViewType(string evidenceType)
    {
        return evidenceType switch
        {
            "spectrum" => "spectrum",
            "spectrogram" => "spectrogram",
            "cpb" => "cpb",
            "sound_quality" => "soundQuality",
            "findings" => "findings",
            _ => null,
        };
    }

    private static bool HasResultId(EvidenceItem evidenceItem)
    {
        if (!evidenceItem.Data.TryGetValue("resultId", out var resultId))
        {
            return false;
        }

        return resultId is string resultIdString && !string.IsNullOrWhiteSpace(resultIdString);
    }

    public static PlotHints? BuildPlotHintsFor(EvidenceItem evidenceItem)
    {
        if (evidenceItem.Type != "spectrum")
        {
            return null;
        }

        if (!evidenceItem.Data.TryGetValue("peakFrequencyHz", out var peakFreqRaw))
        {
            return null;
        }

        if (peakFreqRaw is not double peakFrequencyHz || peakFrequencyHz <= 0)
        {
            return null;
        }

        var rangeMinHz = peakFrequencyHz / 4.0;
        var rangeMaxHz = peakFrequencyHz * 4.0;
        var annotationLabel = FormatFrequencyAnnotation(peakFrequencyHz);

        return new PlotHints
        {
            FocusFrequencyHz = peakFrequencyHz,
            FrequencyRangeMinHz = rangeMinHz,
            FrequencyRangeMaxHz = rangeMaxHz,
            AnnotationLabel = annotationLabel,
        };
    }

    private static string FormatFrequencyAnnotation(double frequencyHz)
    {
        if (frequencyHz >= 1000.0)
        {
            return $"peak at {frequencyHz / 1000.0:0.##} kHz";
        }

        return $"peak at {frequencyHz:0.#} Hz";
    }
}

public sealed record VisualizationPlan
{
    public required string PrimaryEvidenceType { get; init; }
    public required IReadOnlyList<VisualizationPlanBlock> Blocks { get; init; }
}

public sealed record VisualizationPlanBlock
{
    public required string BlockType { get; init; }
    public required string Reason { get; init; }
    public string? ViewType { get; init; }
    public string? SourceEvidenceId { get; init; }
    public IReadOnlyList<string>? SourceEvidenceIds { get; init; }
    public PlotHints? PlotHints { get; init; }
}
