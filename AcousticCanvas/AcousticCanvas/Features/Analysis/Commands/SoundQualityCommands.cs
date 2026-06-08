using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunSoundQualityQuery(
    string FilePath,
    double StartSeconds,
    double EndSeconds,
    string Method
) : ICommand<SoundQualityAnalysis>;
