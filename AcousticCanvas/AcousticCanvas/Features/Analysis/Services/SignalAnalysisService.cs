using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SignalAnalysisService
{
    private readonly IReadOnlyList<ISignalFileImporter> _importers;
    private readonly SignalFileCacheStore _cacheStore;

    public SignalAnalysisService(
        IReadOnlyList<ISignalFileImporter> importers,
        SignalFileCacheStore cacheStore
    )
    {
        _importers = importers;
        _cacheStore = cacheStore;
    }

    public SignalFile ImportFile(string filePath)
    {
        if (_cacheStore.TryGet(filePath, out var cached) && cached is not null)
        {
            return cached;
        }

        var importer = ResolveImporter(filePath);
        var result = importer.Import(filePath);
        _cacheStore.Set(filePath, result);
        return result;
    }

    public AnalysisResult Analyze(string filePath)
    {
        var signalFile = ImportFile(filePath);
        var levelAnalysis = LevelAnalyzer.Analyze(signalFile.Channels);

        return new AnalysisResult
        {
            FileInfo = signalFile.FileInfo,
            Level = levelAnalysis,
            AnalyzedAt = DateTimeOffset.UtcNow,
        };
    }

    private ISignalFileImporter ResolveImporter(string filePath)
    {
        foreach (var importer in _importers)
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
