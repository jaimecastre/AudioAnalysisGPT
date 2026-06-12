using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunSpectrogramQuery(
    string FilePath,
    double StartSeconds,
    double EndSeconds,
    int FftSize,
    double Overlap,
    string Scale,
    double GainDb,
    double RangeDb,
    double MinDbSpl = -68.0,
    double MaxDbSpl = 55.0
) : ICommand<SpectrogramAnalysis>;
