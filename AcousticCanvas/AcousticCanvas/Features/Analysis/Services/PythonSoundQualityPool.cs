using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

/// <summary>
/// Process pool for Python sound quality analysis. Maintains persistent Python
/// processes to eliminate ~5-7 second startup overhead per analysis call.
/// </summary>
public sealed class PythonSoundQualityPool : ISoundQualityClient, IDisposable
{
    private const int DefaultPoolSize = 2;
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(120);
    private static readonly TimeSpan ProcessStartupTimeout = TimeSpan.FromSeconds(30);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IConfiguration _configuration;
    private readonly int _poolSize;
    private readonly ConcurrentBag<PoolProcess> _availableProcesses = new();
    private readonly SemaphoreSlim _processSemaphore;
    private bool _isInitialized;
    private bool _isDisposed;

    public PythonSoundQualityPool(IConfiguration configuration, int poolSize = DefaultPoolSize)
    {
        _configuration = configuration;
        _poolSize = poolSize;
        _processSemaphore = new SemaphoreSlim(poolSize, poolSize);
    }

    /// <summary>
    /// Initialize the pool by starting all Python processes.
    /// Call this once at application startup.
    /// </summary>
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        if (_isInitialized)
            return;

        var startupTasks = new List<Task<PoolProcess>>();
        for (int i = 0; i < _poolSize; i++)
        {
            startupTasks.Add(StartProcessAsync(cancellationToken));
        }

        var processes = await Task.WhenAll(startupTasks);
        foreach (var process in processes)
        {
            _availableProcesses.Add(process);
        }

        _isInitialized = true;
    }

    public async Task<SoundQualityAnalysis> AnalyzeAsync(
        RunSoundQualityQuery query,
        CancellationToken cancellationToken)
    {
        EnsureInitialized();

        await _processSemaphore.WaitAsync(cancellationToken);
        try
        {
            PoolProcess? process = null;
            while (!_availableProcesses.TryTake(out process))
            {
                await Task.Delay(10, cancellationToken);
            }

            try
            {
                var result = await ExecuteWithProcessAsync(process, query, cancellationToken);
                _availableProcesses.Add(process);
                return result;
            }
            catch (Exception)
            {
                // Process failed, dispose it and start a new one
                DisposeProcess(process);
                var newProcess = await StartProcessAsync(cancellationToken);
                _availableProcesses.Add(newProcess);
                throw;
            }
        }
        finally
        {
            _processSemaphore.Release();
        }
    }

    private async Task<SoundQualityAnalysis> ExecuteWithProcessAsync(
        PoolProcess poolProcess,
        RunSoundQualityQuery query,
        CancellationToken cancellationToken)
    {
        var request = new
        {
            filePath = query.FilePath,
            startSeconds = query.StartSeconds,
            endSeconds = query.EndSeconds,
            method = query.Method,
        };

        var requestJson = JsonSerializer.Serialize(request, JsonOptions);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(DefaultTimeout);

        // Send request
        await poolProcess.StandardInput.WriteLineAsync(requestJson);
        await poolProcess.StandardInput.FlushAsync();

        // Read response
        var responseTask = poolProcess.StandardOutput.ReadLineAsync();
        var completedTask = await Task.WhenAny(
            responseTask,
            Task.Delay(DefaultTimeout, timeoutCts.Token)
        );

        if (completedTask != responseTask)
        {
            throw BuildUnavailableException(
                $"Python pool worker timed out after {DefaultTimeout.TotalSeconds:0} seconds."
            );
        }

        var responseJson = await responseTask;
        if (string.IsNullOrWhiteSpace(responseJson))
        {
            throw BuildUnavailableException("Python pool worker returned empty response.");
        }

        using var document = JsonDocument.Parse(responseJson);
        var root = document.RootElement;

        if (root.TryGetProperty("error", out var errorElement))
        {
            throw BuildUnavailableException(errorElement.GetString() ?? "Unknown error from Python worker.");
        }

        var analysis = JsonSerializer.Deserialize<SoundQualityAnalysis>(responseJson, JsonOptions);
        if (analysis is null)
        {
            throw BuildUnavailableException("Python pool worker returned invalid JSON.");
        }

        return analysis;
    }

    private async Task<PoolProcess> StartProcessAsync(CancellationToken cancellationToken)
    {
        var scriptPath = ResolveScriptPath();
        if (!File.Exists(scriptPath))
        {
            throw BuildUnavailableException($"Pool script not found: {scriptPath}");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = ResolvePythonExecutable(),
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };

        // Set up environment (same as single-process version)
        var cacheRoot = Path.Combine(Path.GetTempPath(), "acousticcanvas-sound-quality-cache");
        var matplotlibConfigDirectory = Path.Combine(cacheRoot, "matplotlib");
        var xdgCacheDirectory = Path.Combine(cacheRoot, "xdg");
        var fontconfigDirectory = Path.Combine(cacheRoot, "fontconfig");
        var fontconfigCacheDirectory = Path.Combine(fontconfigDirectory, "cache");
        var fontconfigFilePath = Path.Combine(fontconfigDirectory, "fonts.conf");
        Directory.CreateDirectory(matplotlibConfigDirectory);
        Directory.CreateDirectory(xdgCacheDirectory);
        Directory.CreateDirectory(fontconfigCacheDirectory);
        WriteFontconfigFileIfMissing(fontconfigFilePath, fontconfigCacheDirectory);
        startInfo.Environment["MPLBACKEND"] = "Agg";
        startInfo.Environment["MPLCONFIGDIR"] = matplotlibConfigDirectory;
        startInfo.Environment["XDG_CACHE_HOME"] = xdgCacheDirectory;
        startInfo.Environment["FONTCONFIG_FILE"] = fontconfigFilePath;
        startInfo.ArgumentList.Add(scriptPath);

        var process = Process.Start(startInfo);
        if (process is null)
        {
            throw BuildUnavailableException("Could not start Python pool worker.");
        }

        // Wait for ready signal
        using var readyCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        readyCts.CancelAfter(ProcessStartupTimeout);

        try
        {
            var readyLine = await process.StandardOutput.ReadLineAsync(readyCts.Token);
            if (string.IsNullOrWhiteSpace(readyLine))
            {
                process.Kill(entireProcessTree: true);
                throw BuildUnavailableException("Python pool worker did not send ready signal.");
            }

            using var readyDoc = JsonDocument.Parse(readyLine);
            if (!readyDoc.RootElement.TryGetProperty("ready", out _))
            {
                process.Kill(entireProcessTree: true);
                throw BuildUnavailableException($"Python pool worker sent unexpected ready signal: {readyLine}");
            }
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw BuildUnavailableException(
                $"Python pool worker startup timed out after {ProcessStartupTimeout.TotalSeconds:0} seconds."
            );
        }
        catch (Exception ex)
        {
            process.Kill(entireProcessTree: true);
            throw BuildUnavailableException($"Python pool worker startup failed: {ex.Message}");
        }

        return new PoolProcess(process);
    }

    private void DisposeProcess(PoolProcess? poolProcess)
    {
        if (poolProcess == null) return;

        try
        {
            poolProcess.Process.Kill(entireProcessTree: true);
            poolProcess.Process.WaitForExit(TimeSpan.FromSeconds(5));
        }
        catch
        {
            // Best-effort cleanup
        }

        poolProcess.Dispose();
    }

    private void EnsureInitialized()
    {
        if (!_isInitialized)
        {
            throw new InvalidOperationException(
                "PythonSoundQualityPool must be initialized before use. Call InitializeAsync() at startup."
            );
        }
    }

    private string ResolveScriptPath()
    {
        var configuredPath = _configuration["PythonSidecar:SoundQualityPoolScript"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

        return Path.GetFullPath(
            Path.Combine(
                Directory.GetCurrentDirectory(),
                "..",
                "AcousticCanvas.ML",
                "sound_quality_pool.py"
            )
        );
    }

    private string ResolvePythonExecutable()
    {
        var configuredExecutable = _configuration["PythonSidecar:Executable"];
        if (!string.IsNullOrWhiteSpace(configuredExecutable))
        {
            return configuredExecutable;
        }

        var candidatePaths = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "..", ".venv", "bin", "python"),
            Path.Combine(Directory.GetCurrentDirectory(), "AcousticCanvas", ".venv", "bin", "python"),
        };

        foreach (var candidatePath in candidatePaths)
        {
            var fullPath = Path.GetFullPath(candidatePath);
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        return "python3";
    }

    private static void WriteFontconfigFileIfMissing(string fontconfigFilePath, string fontconfigCacheDirectory)
    {
        if (File.Exists(fontconfigFilePath))
        {
            return;
        }

        var fontconfigFile = $"""
            <?xml version="1.0"?>
            <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
            <fontconfig>
              <dir>/System/Library/Fonts</dir>
              <dir>/Library/Fonts</dir>
              <cachedir>{fontconfigCacheDirectory}</cachedir>
            </fontconfig>
            """;
        File.WriteAllText(fontconfigFilePath, fontconfigFile);
    }

    private static InvalidOperationException BuildUnavailableException(string detail)
    {
        return new InvalidOperationException(
            "Python sound-quality pool unavailable. " + detail
        );
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        _isDisposed = true;

        _processSemaphore.Dispose();

        while (_availableProcesses.TryTake(out var process))
        {
            DisposeProcess(process);
        }
    }

    private sealed class PoolProcess : IDisposable
    {
        public Process Process { get; }
        public StreamWriter StandardInput => Process.StandardInput;
        public StreamReader StandardOutput => Process.StandardOutput;

        public PoolProcess(Process process)
        {
            Process = process;
        }

        public void Dispose()
        {
            try
            {
                StandardInput.Dispose();
                StandardOutput.Dispose();
                Process.Dispose();
            }
            catch
            {
                // Best-effort cleanup
            }
        }
    }
}
