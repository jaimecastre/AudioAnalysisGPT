using FastEndpoints;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunSpectrumQuery(
    string FilePath,
    double StartSeconds,
    double EndSeconds,
    int FftSize,
    double Overlap
) : ICommand<SpectrumAnalysis>;
