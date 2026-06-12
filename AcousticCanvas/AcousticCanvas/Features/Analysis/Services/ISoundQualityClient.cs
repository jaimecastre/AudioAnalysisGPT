using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public interface ISoundQualityClient
{
    Task<SoundQualityAnalysis> AnalyzeAsync(
        RunSoundQualityQuery query,
        CancellationToken cancellationToken
    );
}
