using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SoundQualityAnalysisService(ISoundQualityClient soundQualityClient)
{
    public Task<SoundQualityAnalysis> AnalyzeAsync(RunSoundQualityQuery query, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return soundQualityClient.AnalyzeAsync(query, cancellationToken);
    }
}
