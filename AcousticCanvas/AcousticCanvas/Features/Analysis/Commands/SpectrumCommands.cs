using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunSpectrumQuery(
    string FilePath,
    double StartSeconds,
    double EndSeconds,
    int FftSize,
    double Overlap,
    SpectrumWindowType WindowType = SpectrumWindowType.Hann
) : ICommand<SpectrumAnalysis>;
