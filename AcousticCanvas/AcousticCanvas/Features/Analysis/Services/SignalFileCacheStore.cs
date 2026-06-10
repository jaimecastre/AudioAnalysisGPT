using AcousticCanvas.Features.Analysis.Domain;
using System.Collections.Concurrent;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class SignalFileCacheStore
{
    private readonly record struct SignalFileCacheKey(string FilePath, long LastWriteTimeUtcTicks);

    private readonly ConcurrentDictionary<SignalFileCacheKey, SignalFile> _cache = new();

    public bool TryGet(string filePath, out SignalFile? result)
    {
        var lastWriteTimeTicks = File.GetLastWriteTimeUtc(filePath).Ticks;
        var key = new SignalFileCacheKey(filePath, lastWriteTimeTicks);
        return _cache.TryGetValue(key, out result);
    }

    public void Set(string filePath, SignalFile result)
    {
        var lastWriteTimeTicks = File.GetLastWriteTimeUtc(filePath).Ticks;
        var key = new SignalFileCacheKey(filePath, lastWriteTimeTicks);
        _cache[key] = result;
    }
}
