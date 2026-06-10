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
    private const int FindingsSpectrumFftSize = 8192;
    private const double FindingsSpectrumOverlap = 0.5;

    public override async Task<FindingsResult> ExecuteAsync(RunFindingsCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(command.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {command.FilePath}");
        }

        var levelAnalysisResult = analysisService.Analyze(command.FilePath);
        var levelAnalysis = levelAnalysisResult.Level;
        var durationSeconds = levelAnalysisResult.FileInfo.DurationSeconds;

        var eventTasks = AllEventKinds
            .Select(kind => new FindEventsCommand(
                Kind: kind,
                FilePath: command.FilePath,
                StartSeconds: null,
                EndSeconds: null).ExecuteAsync(ct))
            .ToArray();
        var allEventResults = await Task.WhenAll(eventTasks);

        var spectrumCommand = new RunSpectrumQuery(
            FilePath: command.FilePath,
            StartSeconds: 0.0,
            EndSeconds: durationSeconds,
            FftSize: FindingsSpectrumFftSize,
            Overlap: FindingsSpectrumOverlap
        );
        var spectrumAnalysis = await spectrumCommand.ExecuteAsync(ct);

        var findings = FindingsEngine.GenerateFindings(command.FilePath, levelAnalysis, allEventResults, spectrumAnalysis);

        return new FindingsResult
        {
            FileId = command.FilePath,
            Findings = findings,
            FindingCount = findings.Count,
            RanAt = DateTimeOffset.UtcNow,
        };
    }
}
