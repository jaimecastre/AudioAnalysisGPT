using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunCompareCommand(
    IReadOnlyList<string> FilePaths,
    double? StartSeconds,
    double? EndSeconds,
    bool SkipPairwiseDiffs = false
) : ICommand<CompareResult>;
