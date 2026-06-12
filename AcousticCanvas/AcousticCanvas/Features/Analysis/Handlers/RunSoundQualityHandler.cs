using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public sealed class RunSoundQualityHandler(SoundQualityAnalysisService soundQualityAnalysisService)
    : CommandHandler<RunSoundQualityQuery, SoundQualityAnalysis>
{
    public override Task<SoundQualityAnalysis> ExecuteAsync(
        RunSoundQualityQuery query,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(query.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {query.FilePath}");
        }

        if (query.EndSeconds <= query.StartSeconds)
        {
            throw new ArgumentException(
                $"Region end ({query.EndSeconds:F3}s) must be greater than start ({query.StartSeconds:F3}s)."
            );
        }

        return soundQualityAnalysisService.AnalyzeAsync(query, ct);
    }
}
