using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunSpectrumHandler(IReadOnlyList<ISignalFileImporter> importers)
    : CommandHandler<RunSpectrumQuery, SpectrumAnalysis>
{
    public override Task<SpectrumAnalysis> ExecuteAsync(
        RunSpectrumQuery query,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(query.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {query.FilePath}");
        }

        if (query.EndSeconds <= query.StartSeconds)
        {
            throw new ArgumentException(
                $"Region end ({query.EndSeconds:F3}s) must be greater than start ({query.StartSeconds:F3}s)."
            );
        }

        var importer = ResolveImporter(query.FilePath);
        var signalFile = importer.Import(query.FilePath);

        var result = SpectrumAnalyzer.Analyze(
            signalFile.Channels,
            query.StartSeconds,
            query.EndSeconds,
            query.FftSize,
            query.Overlap,
            query.WindowType
        );

        return Task.FromResult(result);
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
        throw new NotSupportedException(
            $"No importer found for file: {Path.GetFileName(filePath)}"
        );
    }
}
