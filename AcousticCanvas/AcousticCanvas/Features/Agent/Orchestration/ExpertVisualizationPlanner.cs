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
                Reason = evidencePackage.KeyEvidence.Count == 0
                    ? "Use text to answer a method or context question without inventing measured values."
                    : "Use text to summarize measured evidence and limitations.",
            },
        };

        AddEvidenceViewBlocks(evidencePackage, blocks);
        AddRankingBlockWhenUseful(evidencePackage, blocks);

        var primaryEvidenceType = DeterminePrimaryEvidenceType(evidencePackage);

        return new VisualizationPlan
        {
            PrimaryEvidenceType = primaryEvidenceType,
            Blocks = blocks,
        };
    }

    private static void AddEvidenceViewBlocks(
        EvidencePackage evidencePackage,
        List<VisualizationPlanBlock> blocks
    )
    {
        foreach (var evidenceItem in evidencePackage.KeyEvidence)
        {
            var viewType = MapEvidenceTypeToViewType(evidenceItem.Type);
            if (viewType is null)
            {
                continue;
            }

            if (!HasResultId(evidenceItem))
            {
                continue;
            }

            blocks.Add(
                new VisualizationPlanBlock
                {
                    BlockType = "analysisView",
                    ViewType = viewType,
                    SourceEvidenceId = evidenceItem.EvidenceId,
                    Reason = $"Show the {viewType} result in the trusted analysis view so the user can inspect measured data and metadata.",
                }
            );
        }
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
                Reason = "Compare multiple files with a ranking block before the narrative so differences can be scanned quickly.",
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
}
