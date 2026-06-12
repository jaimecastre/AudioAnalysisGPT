using AcousticCanvas.Features.Analysis.Domain;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record FindEventsCommand(
    string Kind,
    string FilePath,
    double? StartSeconds,
    double? EndSeconds
) : ICommand<FindEventsResult>;
