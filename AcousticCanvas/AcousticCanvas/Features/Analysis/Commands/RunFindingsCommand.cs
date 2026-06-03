using FastEndpoints;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunFindingsCommand(
    string FilePath
) : ICommand<FindingsResult>;
