using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunFindingsCommand(string FilePath) : ICommand<FindingsResult>;
