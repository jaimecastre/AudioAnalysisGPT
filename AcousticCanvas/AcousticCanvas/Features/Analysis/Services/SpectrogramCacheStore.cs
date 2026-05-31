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
        double Overlap,
        string Scale,
        double GainDb,
        double RangeDb);

    private readonly ConcurrentDictionary<SpectrogramCacheKey, SpectrogramAnalysis> _cache = new();

    public bool TryGet(
        string filePath,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        string scale,
        double gainDb,
        double rangeDb,
        out SpectrogramAnalysis? result)
    {
        var key = new SpectrogramCacheKey(filePath, startSeconds, endSeconds, fftSize, overlap, scale, gainDb, rangeDb);
        return _cache.TryGetValue(key, out result);
    }

    public void Set(
        string filePath,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        string scale,
        double gainDb,
        double rangeDb,
        SpectrogramAnalysis result)
    {
        var key = new SpectrogramCacheKey(filePath, startSeconds, endSeconds, fftSize, overlap, scale, gainDb, rangeDb);
        _cache[key] = result;
    }
}
