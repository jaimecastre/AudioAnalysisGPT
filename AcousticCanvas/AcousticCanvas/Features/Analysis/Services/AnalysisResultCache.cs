namespace AcousticCanvas.Features.Analysis.Services;

/// <summary>
/// Simple in-memory cache for storing analysis results by ID.
/// Used by Agent mode to retrieve analysis results for display in AnalysisViewBlock.
/// </summary>
public sealed class AnalysisResultCache
{
    private readonly Dictionary<string, CachedAnalysisResult> _cache = new();
    private readonly TimeSpan _defaultExpiration = TimeSpan.FromHours(1);

    public string StoreResult(object result, string analysisType)
    {
        var resultId = $"{analysisType}_{Guid.NewGuid():N}";
        var cachedResult = new CachedAnalysisResult
        {
            Id = resultId,
            Type = analysisType,
            Data = result,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_defaultExpiration),
        };

        lock (_cache)
        {
            _cache[resultId] = cachedResult;
            CleanupExpiredEntries();
        }

        return resultId;
    }

    public CachedAnalysisResult? GetResult(string resultId)
    {
        lock (_cache)
        {
            if (_cache.TryGetValue(resultId, out var result))
            {
                if (result.ExpiresAt > DateTime.UtcNow)
                {
                    return result;
                }
                _cache.Remove(resultId);
            }
            return null;
        }
    }

    public void RemoveResult(string resultId)
    {
        lock (_cache)
        {
            _cache.Remove(resultId);
        }
    }

    private void CleanupExpiredEntries()
    {
        var now = DateTime.UtcNow;
        var expiredKeys = _cache
            .Where(kvp => kvp.Value.ExpiresAt <= now)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
        {
            _cache.Remove(key);
        }
    }
}

public sealed class CachedAnalysisResult
{
    public required string Id { get; init; }
    public required string Type { get; init; }
    public required object Data { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required DateTime ExpiresAt { get; init; }
}
