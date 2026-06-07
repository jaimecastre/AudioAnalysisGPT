using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunCpbQuery(
    string FilePath,
    double StartSeconds,
    double EndSeconds,
    string BandMode,
    int FftSize,
    double Overlap,
    string Weighting
) : ICommand<CpbAnalysis>;
