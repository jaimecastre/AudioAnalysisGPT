using System.Diagnostics;
using System.Text.Json;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class PythonCpbFilterBankClient(IConfiguration configuration) : ICpbFilterBankClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<CpbAnalysis> AnalyzeAsync(
        RunCpbQuery query,
        IReadOnlyList<SignalChannel> channels,
        CancellationToken cancellationToken
    )
    {
        var pythonExecutable = ResolvePythonExecutable();
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
            bandMode = query.BandMode,
            weighting = query.Weighting,
            channels = channels
                .Select(channel => new
                {
                    channelId = channel.Id,
                    channelName = channel.Name,
                    quantity = channel.Quantity,
                    unit = channel.Unit,
                    dbUnit = channel.DbReference?.DbUnit,
                })
                .ToArray(),
        };

        var startInfo = new ProcessStartInfo
        {
            FileName = pythonExecutable,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.Environment["MPLCONFIGDIR"] = Path.Combine(
            Path.GetTempPath(),
            "acousticcanvas-matplotlib"
        );
        startInfo.ArgumentList.Add(scriptPath);

        try
        {
            using var process = Process.Start(startInfo);
            if (process is null)
            {
                throw BuildUnavailableException(
                    $"Could not start Python executable: {pythonExecutable}"
                );
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
                throw BuildUnavailableException(
                    string.IsNullOrWhiteSpace(stderr)
                        ? $"Python exited with code {process.ExitCode}."
                        : stderr.Trim()
                );
            }

            var analysis = JsonSerializer.Deserialize<CpbAnalysis>(stdout, JsonOptions);
            if (analysis is null)
            {
                throw BuildUnavailableException("Python returned empty CPB analysis output.");
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
        var configuredPath = configuration["PythonSidecar:CpbFilterBankScript"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

        return Path.GetFullPath(
            Path.Combine(
                Directory.GetCurrentDirectory(),
                "..",
                "AcousticCanvas.ML",
                "cpb_filter_bank.py"
            )
        );
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
            Path.Combine(
                Directory.GetCurrentDirectory(),
                "AcousticCanvas",
                ".venv",
                "bin",
                "python"
            ),
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
            "Python CPB filter-bank sidecar unavailable. Install PyOctaveBand and configure the sidecar before selecting python_filter_bank. "
                + $"Detail: {detail}"
        );
    }
}
