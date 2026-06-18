using System.Text.Json;
using System.Text.RegularExpressions;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentResponseBlockParser
{
    public static AgentResponseBlock? Parse(JsonElement element)
    {
        if (!element.TryGetProperty("blockType", out var blockTypeElement))
        {
            return null;
        }

        var blockType = blockTypeElement.GetString();

        return blockType switch
        {
            VisualizationBlockTypes.Markdown => ParseMarkdownBlock(element),
            VisualizationBlockTypes.Statistics => ParseStatisticsBlock(element),
            VisualizationBlockTypes.SpectrumChart => ParseSpectrumChartBlock(element),
            VisualizationBlockTypes.Ranking => ParseRankingBlock(element),
            VisualizationBlockTypes.SuggestedActions => ParseSuggestedActionsBlock(element),
            VisualizationBlockTypes.AnalysisView => ParseAnalysisViewBlock(element),
            _ => null,
        };
    }

    private static MarkdownBlock? ParseMarkdownBlock(JsonElement element)
    {
        if (!element.TryGetProperty("content", out var contentElement))
        {
            return null;
        }

        return new MarkdownBlock { Content = contentElement.GetString() ?? string.Empty };
    }

    private static StatisticsBlock? ParseStatisticsBlock(JsonElement element)
    {
        if (!element.TryGetProperty("title", out var titleElement))
        {
            return null;
        }

        if (!element.TryGetProperty("rows", out var rowsElement))
        {
            return null;
        }

        var rows = new List<StatisticRow>();
        foreach (var row in rowsElement.EnumerateArray())
        {
            var label = row.TryGetProperty("label", out var labelElement)
                ? labelElement.GetString() ?? string.Empty
                : string.Empty;
            var value = row.TryGetProperty("value", out var valueElement)
                ? valueElement.GetString() ?? string.Empty
                : string.Empty;
            var unit = row.TryGetProperty("unit", out var unitElement)
                ? unitElement.GetString()
                : null;

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
            !element.TryGetProperty("fileId", out var fileIdElement)
            || !element.TryGetProperty("fileName", out var fileNameElement)
            || !element.TryGetProperty("frequenciesHz", out var frequencyElement)
            || !element.TryGetProperty("magnitudesDb", out var magnitudeElement)
        )
        {
            return null;
        }

        var frequencies = frequencyElement.EnumerateArray().Select(f => f.GetDouble()).ToList();
        var magnitudes = magnitudeElement.EnumerateArray().Select(m => m.GetDouble()).ToList();
        var peakFrequency = element.TryGetProperty("peakFrequencyHz", out var peakElement)
            ? peakElement.GetDouble()
            : (double?)null;

        var metadata = ParseChartMetadata(element);

        return new SpectrumChartBlock
        {
            FileId = fileIdElement.GetString() ?? string.Empty,
            FileName = fileNameElement.GetString() ?? string.Empty,
            FrequenciesHz = frequencies,
            MagnitudesDb = magnitudes,
            PeakFrequencyHz = peakFrequency,
            Metadata = metadata,
        };
    }

    private static ChartMetadata ParseChartMetadata(JsonElement element)
    {
        var metadata = new ChartMetadata();
        if (!element.TryGetProperty("metadata", out var metadataElement))
        {
            return metadata;
        }

        if (metadataElement.TryGetProperty("sourceTool", out var sourceToolElement))
        {
            metadata = metadata with { SourceTool = sourceToolElement.GetString() };
        }

        if (metadataElement.TryGetProperty("fftSize", out var fftSizeElement))
        {
            metadata = metadata with { FftSize = fftSizeElement.GetInt32() };
        }

        if (metadataElement.TryGetProperty("windowType", out var windowTypeElement))
        {
            metadata = metadata with { WindowType = windowTypeElement.GetString() };
        }

        if (metadataElement.TryGetProperty("scaling", out var scalingElement))
        {
            metadata = metadata with { Scaling = scalingElement.GetString() };
        }

        return metadata;
    }

    private static RankingBlock? ParseRankingBlock(JsonElement element)
    {
        if (
            !element.TryGetProperty("title", out var titleElement)
            || !element.TryGetProperty("metricName", out var metricElement)
            || !element.TryGetProperty("rankedItems", out var itemsElement)
        )
        {
            return null;
        }

        var items = new List<RankedItem>();
        foreach (var item in itemsElement.EnumerateArray())
        {
            if (
                !item.TryGetProperty("rank", out var rankElement)
                || !item.TryGetProperty("fileId", out var fileIdElement)
                || !item.TryGetProperty("fileName", out var fileNameElement)
                || !item.TryGetProperty("score", out var scoreElement)
                || !item.TryGetProperty("scoreLabel", out var scoreLabelElement)
            )
            {
                continue;
            }

            items.Add(
                new RankedItem
                {
                    Rank = rankElement.GetInt32(),
                    FileId = fileIdElement.GetString() ?? string.Empty,
                    FileName = fileNameElement.GetString() ?? string.Empty,
                    Score = scoreElement.GetDouble(),
                    ScoreLabel = scoreLabelElement.GetString() ?? string.Empty,
                    ScoreUnit = item.TryGetProperty("scoreUnit", out var unitElement)
                        ? unitElement.GetString()
                        : null,
                }
            );
        }

        return new RankingBlock
        {
            Title = titleElement.GetString() ?? string.Empty,
            MetricName = metricElement.GetString() ?? string.Empty,
            RankedItems = items,
        };
    }

    private static SuggestedActionsBlock? ParseSuggestedActionsBlock(JsonElement element)
    {
        if (!element.TryGetProperty("actions", out var actionsElement))
        {
            return null;
        }

        var actions = new List<SuggestedAction>();
        foreach (var action in actionsElement.EnumerateArray())
        {
            if (
                !action.TryGetProperty("label", out var labelElement)
                || !action.TryGetProperty("actionType", out var typeElement)
            )
            {
                continue;
            }

            actions.Add(
                new SuggestedAction
                {
                    Label = labelElement.GetString() ?? string.Empty,
                    ActionType = typeElement.GetString() ?? string.Empty,
                    ToolName = action.TryGetProperty("toolName", out var toolElement)
                        ? toolElement.GetString()
                        : null,
                    PromptText = action.TryGetProperty("promptText", out var promptElement)
                        ? promptElement.GetString()
                        : null,
                }
            );
        }

        return new SuggestedActionsBlock { Actions = actions };
    }

    private static AnalysisViewBlock? ParseAnalysisViewBlock(JsonElement element)
    {
        if (
            !element.TryGetProperty("viewType", out var viewTypeElement)
            || !element.TryGetProperty("resultId", out var resultIdElement)
            || !element.TryGetProperty("fileId", out var fileIdElement)
            || !element.TryGetProperty("fileName", out var fileNameElement)
            || !element.TryGetProperty("summary", out var summaryElement)
        )
        {
            return null;
        }

        var resultId = resultIdElement.GetString() ?? string.Empty;
        if (!Regex.IsMatch(resultId, @"^[a-z]+_[0-9a-f]{32}$"))
        {
            return null;
        }

        var summary = ParseCompactSummary(summaryElement);
        var preview = element.TryGetProperty("preview", out var previewElement)
            ? ParseAnalysisPreview(previewElement)
            : null;

        return new AnalysisViewBlock
        {
            ViewType = viewTypeElement.GetString() ?? string.Empty,
            ResultId = resultId,
            FileId = fileIdElement.GetString() ?? string.Empty,
            FileName = fileNameElement.GetString() ?? string.Empty,
            Summary = summary,
            Title = element.TryGetProperty("title", out var titleElement)
                ? titleElement.GetString()
                : null,
            Preview = preview,
        };
    }

    private static AnalysisPreview? ParseAnalysisPreview(JsonElement element)
    {
        double[]? frequenciesHz = null;
        double[]? magnitudesDb = null;

        if (
            element.TryGetProperty("frequenciesHz", out var frequencyElement)
            && frequencyElement.ValueKind == JsonValueKind.Array
        )
        {
            frequenciesHz = frequencyElement.EnumerateArray().Select(e => e.GetDouble()).ToArray();
        }

        if (
            element.TryGetProperty("magnitudesDb", out var magnitudeElement)
            && magnitudeElement.ValueKind == JsonValueKind.Array
        )
        {
            magnitudesDb = magnitudeElement.EnumerateArray().Select(e => e.GetDouble()).ToArray();
        }

        if (frequenciesHz == null || magnitudesDb == null)
        {
            return null;
        }

        return new AnalysisPreview { FrequenciesHz = frequenciesHz, MagnitudesDb = magnitudesDb };
    }

    private static CompactSummary ParseCompactSummary(JsonElement element)
    {
        var summary = new CompactSummary();

        if (element.TryGetProperty("primaryMetric", out var primaryElement))
        {
            summary = summary with { PrimaryMetric = primaryElement.GetString() };
        }

        if (element.TryGetProperty("statusText", out var statusTextElement))
        {
            summary = summary with { StatusText = statusTextElement.GetString() };
        }

        if (element.TryGetProperty("statusIndicator", out var indicatorElement))
        {
            summary = summary with { StatusIndicator = indicatorElement.GetString() };
        }

        if (element.TryGetProperty("secondaryMetrics", out var metricsElement))
        {
            summary = summary with { SecondaryMetrics = ParseMetricItems(metricsElement) };
        }

        return summary;
    }

    private static List<MetricItem> ParseMetricItems(JsonElement metricsElement)
    {
        var metrics = new List<MetricItem>();
        foreach (var metric in metricsElement.EnumerateArray())
        {
            if (
                !metric.TryGetProperty("label", out var labelElement)
                || !metric.TryGetProperty("value", out var valueElement)
            )
            {
                continue;
            }

            metrics.Add(
                new MetricItem
                {
                    Label = labelElement.GetString() ?? string.Empty,
                    Value = valueElement.GetString() ?? string.Empty,
                    Unit = metric.TryGetProperty("unit", out var unitElement)
                        ? unitElement.GetString()
                        : null,
                }
            );
        }

        return metrics;
    }
}
