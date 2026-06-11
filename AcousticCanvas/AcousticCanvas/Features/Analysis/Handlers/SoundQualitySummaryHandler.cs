using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public sealed class SoundQualitySummaryHandler(
    AudioFileRepository audioFileRepository,
    SoundQualityAnalysisService soundQualityAnalysisService)
    : CommandHandler<SoundQualitySummaryRequest, SoundQualitySummaryResult>
{
    public override async Task<SoundQualitySummaryResult> ExecuteAsync(SoundQualitySummaryRequest request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var filePath = audioFileRepository.GetFilePath(request.FileId);
        if (string.IsNullOrEmpty(filePath))
        {
            throw new FileNotFoundException($"File not found: {request.FileId}");
        }

        var fileInfo = await GetFileInfoAsync(filePath, ct);
        if (fileInfo == null)
        {
            throw new FileNotFoundException($"Could not read file info: {request.FileId}");
        }

        var soundQualityQuery = new RunSoundQualityQuery(
            FilePath: filePath,
            StartSeconds: 0.0,
            EndSeconds: fileInfo.DurationSeconds,
            Method: "python_filter_bank");

        var soundQualityAnalysis = await soundQualityAnalysisService.AnalyzeAsync(soundQualityQuery, ct);

        var assessments = new Dictionary<string, string>
        {
            ["loudness"] = SoundQualityThresholds.AssessLoudness(soundQualityAnalysis.Loudness.Value),
            ["sharpness"] = SoundQualityThresholds.AssessSharpness(soundQualityAnalysis.Sharpness.Value),
            ["roughness"] = SoundQualityThresholds.AssessRoughness(soundQualityAnalysis.Roughness.Value)
        };

        var overallAssessment = DetermineOverallAssessment(assessments);
        var keyFindings = GenerateKeyFindings(soundQualityAnalysis, assessments);
        var topMetrics = GetTopMetrics(soundQualityAnalysis, assessments);
        var recommendations = GenerateRecommendations(assessments);

        return new SoundQualitySummaryResult(
            FileId: request.FileId,
            FileName: fileInfo.FileName,
            OverallAssessment: overallAssessment,
            KeyFindings: keyFindings,
            TopMetrics: topMetrics,
            Recommendations: recommendations);
    }

    private static string DetermineOverallAssessment(Dictionary<string, string> assessments)
    {
        // Overall assessment is driven by the worst metric
        if (assessments.Values.Any(a => a == "Poor"))
        {
            return "Poor";
        }
        if (assessments.Values.Any(a => a == "Fair"))
        {
            return "Fair";
        }
        return "Good";
    }

    private static List<string> GenerateKeyFindings(SoundQualityAnalysis analysis, Dictionary<string, string> assessments)
    {
        var findings = new List<string>();

        if (assessments["loudness"] == "Poor")
        {
            findings.Add($"Loudness ({analysis.Loudness.Value:F1} {analysis.Loudness.Unit}) exceeds 85 dB SPL threshold.");
        }
        else if (assessments["loudness"] == "Fair")
        {
            findings.Add($"Loudness ({analysis.Loudness.Value:F1} {analysis.Loudness.Unit}) is in the fair range (70-85 dB SPL).");
        }

        if (assessments["sharpness"] == "Poor")
        {
            findings.Add($"Sharpness ({analysis.Sharpness.Value:F1} {analysis.Sharpness.Unit}) exceeds 4 acum threshold.");
        }
        else if (assessments["sharpness"] == "Fair")
        {
            findings.Add($"Sharpness ({analysis.Sharpness.Value:F1} {analysis.Sharpness.Unit}) is in the fair range (2-4 acum).");
        }

        if (assessments["roughness"] == "Poor")
        {
            findings.Add($"Roughness ({analysis.Roughness.Value:F1} {analysis.Roughness.Unit}) exceeds 1.0 asper threshold.");
        }
        else if (assessments["roughness"] == "Fair")
        {
            findings.Add($"Roughness ({analysis.Roughness.Value:F1} {analysis.Roughness.Unit}) is in the fair range (0.5-1.0 asper).");
        }

        if (findings.Count == 0)
        {
            findings.Add("All sound quality metrics are within good ranges.");
        }

        return findings;
    }

    private static List<TopMetric> GetTopMetrics(SoundQualityAnalysis analysis, Dictionary<string, string> assessments)
    {
        var metrics = new List<TopMetric>
        {
            new TopMetric("Loudness", analysis.Loudness.Value, analysis.Loudness.Unit, assessments["loudness"]),
            new TopMetric("Sharpness", analysis.Sharpness.Value, analysis.Sharpness.Unit, assessments["sharpness"]),
            new TopMetric("Roughness", analysis.Roughness.Value, analysis.Roughness.Unit, assessments["roughness"])
        };

        return metrics.OrderByDescending(m => m.Value).Take(3).ToList();
    }

    private static List<string> GenerateRecommendations(Dictionary<string, string> assessments)
    {
        var recommendations = new List<string>();

        if (assessments["loudness"] == "Poor")
        {
            recommendations.Add("Consider reducing loudness levels to avoid hearing damage.");
        }
        else if (assessments["loudness"] == "Fair")
        {
            recommendations.Add("Monitor loudness levels for extended listening sessions.");
        }

        if (assessments["sharpness"] == "Poor")
        {
            recommendations.Add("Consider reducing high-frequency content to improve sharpness.");
        }

        if (assessments["roughness"] == "Poor")
        {
            recommendations.Add("Consider addressing modulation or distortion issues to reduce roughness.");
        }

        if (recommendations.Count == 0)
        {
            recommendations.Add("Sound quality is good; no immediate action required.");
        }

        return recommendations;
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
