using FastEndpoints;
using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunSpectrogramHandler(
    IReadOnlyList<ISignalFileImporter> importers,
    SpectrogramCacheStore cacheStore)
    : CommandHandler<RunSpectrogramQuery, SpectrogramAnalysis>
{
    public override Task<SpectrogramAnalysis> ExecuteAsync(RunSpectrogramQuery query, CancellationToken ct)
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

        if (cacheStore.TryGet(query.FilePath, query.StartSeconds, query.EndSeconds, query.FftSize, query.Overlap, query.Scale, query.GainDb, query.RangeDb, out var cached) && cached != null)
        {
            return Task.FromResult(cached);
        }

        var importer = ResolveImporter(query.FilePath);
        var signalFile = importer.Import(query.FilePath);

        var result = SpectrogramAnalyzer.Analyze(
            signalFile.Channels,
            query.StartSeconds,
            query.EndSeconds,
            query.FftSize,
            query.Overlap,
            query.Scale,
            query.GainDb,
            query.RangeDb);

        cacheStore.Set(query.FilePath, query.StartSeconds, query.EndSeconds, query.FftSize, query.Overlap, query.Scale, query.GainDb, query.RangeDb, result);

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
        throw new NotSupportedException($"No importer found for file: {Path.GetFileName(filePath)}");
    }
}
