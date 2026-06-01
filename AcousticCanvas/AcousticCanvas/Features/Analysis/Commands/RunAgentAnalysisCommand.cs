using FastEndpoints;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Commands;

public record RunAgentAnalysisCommand(
    string Kind,
    string FilePath,
    double? StartSeconds,
    double? EndSeconds
) : ICommand<AgentAnalysisResult>;
