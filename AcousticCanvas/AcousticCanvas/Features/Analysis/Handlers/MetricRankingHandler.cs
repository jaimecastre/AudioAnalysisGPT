using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public sealed class MetricRankingHandler(
    AudioFileRepository audioFileRepository,
    SoundQualityAnalysisService soundQualityAnalysisService)
    : CommandHandler<MetricRankingRequest, MetricRankingResult>
{
    public override async Task<MetricRankingResult> ExecuteAsync(MetricRankingRequest request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (request.FileIds.Count == 0)
        {
            throw new ArgumentException("At least one file ID is required.");
        }

        if (request.Metrics.Count == 0)
        {
            throw new ArgumentException("At least one metric is required.");
        }

        var rankings = new List<MetricRankingRow>();

        var analysisTasks = request.FileIds.Select(async fileId =>
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                return null;
            }

            var fileName = audioFileRepository.GetOriginalFileName(fileId);
            if (string.IsNullOrEmpty(fileName))
            {
                return null;
            }

            var fileInfo = await GetFileInfoAsync(filePath, ct);
            if (fileInfo == null)
            {
                return null;
            }

            var soundQualityQuery = new RunSoundQualityQuery(
                FilePath: filePath,
                StartSeconds: 0.0,
                EndSeconds: fileInfo.DurationSeconds,
                Method: "python_filter_bank");

            try
            {
                var soundQualityAnalysis = await soundQualityAnalysisService.AnalyzeAsync(soundQualityQuery, ct);
                return new { FileId = fileId, FileName = fileName, Analysis = soundQualityAnalysis };
            }
            catch
            {
                return null;
            }
        });

        var analysisResults = await Task.WhenAll(analysisTasks);

        foreach (var result in analysisResults)
        {
            if (result == null)
            {
                continue;
            }

            foreach (var metricName in request.Metrics)
            {
                var metric = GetMetric(result.Analysis, metricName);
                if (metric != null)
                {
                    rankings.Add(new MetricRankingRow(
                        FileId: result.FileId,
                        FileName: result.FileName,
                        MetricName: metricName,
                        Value: metric.Value,
                        Unit: metric.Unit,
                        Rank: 0));
                }
            }
        }

        // Sort by value descending and assign ranks
        var sortedRankings = rankings
            .OrderByDescending(r => r.Value)
            .Select((r, index) => r with { Rank = index + 1 })
            .ToList();

        return new MetricRankingResult(sortedRankings);
    }

    private static SoundQualityMetric? GetMetric(SoundQualityAnalysis analysis, string metricName)
    {
        return metricName.ToLowerInvariant() switch
        {
            "loudness" => analysis.Loudness,
            "sharpness" => analysis.Sharpness,
            "roughness" => analysis.Roughness,
            _ => null
        };
    }

    private async Task<FileInfoAnalysis?> GetFileInfoAsync(string filePath, CancellationToken ct)
    {
        try
        {
            var query = new RunAnalysisQuery(FilePath: filePath);
            var result = await query.ExecuteAsync(ct);
            return result.FileInfo;
        }
        catch
        {
            return null;
        }
    }
}
