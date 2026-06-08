using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunCpbHandler(IReadOnlyList<ISignalFileImporter> importers, CpbAnalysisService cpbAnalysisService)
    : CommandHandler<RunCpbQuery, CpbAnalysis>
{
    public override async Task<CpbAnalysis> ExecuteAsync(RunCpbQuery query, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(query.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {query.FilePath}");
        }

        if (query.EndSeconds <= query.StartSeconds)
        {
            throw new ArgumentException(
                $"Region end ({query.EndSeconds:F3}s) must be greater than start ({query.StartSeconds:F3}s).");
        }

        var importer = ResolveImporter(query.FilePath);
        var signalFile = importer.Import(query.FilePath);

        var result = await cpbAnalysisService.AnalyzeAsync(
            query,
            signalFile.Channels,
            ct);

        return result;
    }

    private ISignalFileImporter ResolveImporter(string filePath)
    {
        foreach (var importer in importers)
        {
            if (importer.CanImport(filePath))
            {
                return importer;
            }
        }
        throw new NotSupportedException($"No importer found for file: {Path.GetFileName(filePath)}");
    }
}
