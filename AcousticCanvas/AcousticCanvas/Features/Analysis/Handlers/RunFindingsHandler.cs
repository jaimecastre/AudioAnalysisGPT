using FastEndpoints;
using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunFindingsHandler(SignalAnalysisService analysisService)
    : CommandHandler<RunFindingsCommand, FindingsResult>
{
    private static readonly string[] AllEventKinds = ["clipping", "silence", "transient", "loudest"];

    public override async Task<FindingsResult> ExecuteAsync(RunFindingsCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(command.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {command.FilePath}");
        }

        var levelAnalysisResult = analysisService.Analyze(command.FilePath);
        var levelAnalysis = levelAnalysisResult.Level;

        var allEventResults = new List<FindEventsResult>();

        foreach (var eventKind in AllEventKinds)
        {
            var findCommand = new FindEventsCommand(
                Kind: eventKind,
                FilePath: command.FilePath,
                StartSeconds: null,
                EndSeconds: null
            );

            var eventResult = await findCommand.ExecuteAsync(ct);
            allEventResults.Add(eventResult);
        }

        var findings = FindingsEngine.GenerateFindings(command.FilePath, levelAnalysis, allEventResults);

        return new FindingsResult
        {
            FileId = command.FilePath,
            Findings = findings,
            FindingCount = findings.Count,
            RanAt = DateTimeOffset.UtcNow,
        };
    }
}
