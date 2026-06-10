using AcousticCanvas.Features.Analysis.Domain;
using System.Collections.Concurrent;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SoundQualityCacheStore
{
    private readonly record struct SoundQualityCacheKey(
        string FilePath,
        double StartSeconds,
        double EndSeconds,
        string Method);

    private readonly ConcurrentDictionary<SoundQualityCacheKey, SoundQualityAnalysis> _cache = new();

    public bool TryGet(
        string filePath,
        double startSeconds,
        double endSeconds,
        string method,
        out SoundQualityAnalysis? result)
    {
        var key = new SoundQualityCacheKey(filePath, startSeconds, endSeconds, method);
        return _cache.TryGetValue(key, out result);
    }

    public void Set(
        string filePath,
        double startSeconds,
        double endSeconds,
        string method,
        SoundQualityAnalysis result)
    {
        var key = new SoundQualityCacheKey(filePath, startSeconds, endSeconds, method);
        _cache[key] = result;
    }
}
