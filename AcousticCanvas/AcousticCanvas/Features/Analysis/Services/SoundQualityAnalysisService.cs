using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SoundQualityAnalysisService(
    ISoundQualityClient soundQualityClient,
    SoundQualityCacheStore cacheStore
)
{
    public async Task<SoundQualityAnalysis> AnalyzeAsync(
        RunSoundQualityQuery query,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (
            cacheStore.TryGet(
                query.FilePath,
                query.StartSeconds,
                query.EndSeconds,
                query.Method,
                out var cached
            ) && cached is not null
        )
        {
            return cached;
        }

        var result = await soundQualityClient.AnalyzeAsync(query, cancellationToken);
        cacheStore.Set(query.FilePath, query.StartSeconds, query.EndSeconds, query.Method, result);
        return result;
    }
}
