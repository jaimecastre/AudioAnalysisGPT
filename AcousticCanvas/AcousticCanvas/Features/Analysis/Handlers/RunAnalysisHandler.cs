using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunAnalysisHandler(SignalAnalysisService analysisService)
    : CommandHandler<RunAnalysisQuery, AnalysisResult>
{
    public override Task<AnalysisResult> ExecuteAsync(RunAnalysisQuery query, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(query.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {query.FilePath}");
        }

        var result = analysisService.Analyze(query.FilePath);
        return Task.FromResult(result);
    }
}
