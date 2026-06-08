using System.Diagnostics;
using System.Text.Json;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class PythonSoundQualityClient(IConfiguration configuration) : ISoundQualityClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<SoundQualityAnalysis> AnalyzeAsync(RunSoundQualityQuery query, CancellationToken cancellationToken)
    {
        var scriptPath = ResolveScriptPath();
        if (!File.Exists(scriptPath))
        {
            throw BuildUnavailableException($"Script not found: {scriptPath}");
        }

        var request = new
        {
            filePath = query.FilePath,
            startSeconds = query.StartSeconds,
            endSeconds = query.EndSeconds,
            method = query.Method,
        };

        var startInfo = new ProcessStartInfo
        {
            FileName = ResolvePythonExecutable(),
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.Environment["MPLCONFIGDIR"] = Path.Combine(Path.GetTempPath(), "acousticcanvas-matplotlib");
        startInfo.ArgumentList.Add(scriptPath);

        try
        {
            using var process = Process.Start(startInfo);
            if (process is null)
            {
                throw BuildUnavailableException("Could not start Python executable.");
            }

            await process.StandardInput.WriteAsync(JsonSerializer.Serialize(request, JsonOptions));
            process.StandardInput.Close();

            var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            var stdout = await stdoutTask;
            var stderr = await stderrTask;
            if (process.ExitCode != 0)
            {
                throw BuildUnavailableException(string.IsNullOrWhiteSpace(stderr) ? $"Python exited with code {process.ExitCode}." : stderr.Trim());
            }

            var analysis = JsonSerializer.Deserialize<SoundQualityAnalysis>(stdout, JsonOptions);
            if (analysis is null)
            {
                throw BuildUnavailableException("Python returned empty sound-quality output.");
            }

            return analysis;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw BuildUnavailableException(exception.Message);
        }
    }

    private string ResolveScriptPath()
    {
        var configuredPath = configuration["PythonSidecar:SoundQualityScript"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

        return Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "AcousticCanvas.ML", "sound_quality.py"));
    }

    private string ResolvePythonExecutable()
    {
        var configuredExecutable = configuration["PythonSidecar:Executable"];
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

    private static InvalidOperationException BuildUnavailableException(string detail)
    {
        return new InvalidOperationException(
            "Python sound-quality sidecar unavailable. Install MoSQITo and configure the sidecar before running sound-quality metrics. " +
            $"Detail: {detail}");
    }
}
