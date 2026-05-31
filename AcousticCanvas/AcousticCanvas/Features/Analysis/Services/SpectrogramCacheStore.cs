using AcousticCanvas.Features.Analysis.Domain;
using System.Collections.Concurrent;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SpectrogramCacheStore
{
    private readonly record struct SpectrogramCacheKey(
        string FilePath,
        double StartSeconds,
        double EndSeconds,
        int FftSize,
        double Overlap);

    private readonly ConcurrentDictionary<SpectrogramCacheKey, SpectrogramAnalysis> _cache = new();

    public bool TryGet(
        string filePath,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        out SpectrogramAnalysis? result)
    {
        var key = new SpectrogramCacheKey(filePath, startSeconds, endSeconds, fftSize, overlap);
        return _cache.TryGetValue(key, out result);
    }

    public void Set(
        string filePath,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        SpectrogramAnalysis result)
    {
        var key = new SpectrogramCacheKey(filePath, startSeconds, endSeconds, fftSize, overlap);
        _cache[key] = result;
    }
}
