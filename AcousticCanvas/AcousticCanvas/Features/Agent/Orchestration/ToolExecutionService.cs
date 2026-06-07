using System.Text.Json;
using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Handlers;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class ToolExecutionService(
    UploadAudioHandler uploadAudioHandler)
{
    private const double DefaultSpectrumStartSeconds = 0.0;
    private const double DefaultSpectrumEndFallback = 600.0;
    private const int DefaultFftSize = 32768;
    private const double DefaultOverlap = 0.5;
    private const string DefaultCpbBandMode = "third_octave";

    public async Task<ToolExecutionOutput> ExecuteToolAsync(
        PlannerToolRequest toolRequest,
        CancellationToken cancellationToken)
    {
        var toolName = toolRequest.Name;

        if (!AgentToolRegistry.IsToolAllowed(toolName))
        {
            return BuildFailureOutput(toolName, "TOOL_NOT_ALLOWED", $"Tool '{toolName}' is not in the allowed tools registry.");
        }

        try
        {
            return toolName switch
            {
                "get_metadata" => await ExecuteGetMetadataAsync(toolRequest.Arguments, cancellationToken),
                "run_basic_metrics" => await ExecuteRunBasicMetricsAsync(toolRequest.Arguments, cancellationToken),
                "run_event_detection" => await ExecuteRunEventDetectionAsync(toolRequest.Arguments, cancellationToken),
                "run_spectrum" => await ExecuteRunSpectrumAsync(toolRequest.Arguments, cancellationToken),
                "run_cpb" => await ExecuteRunCpbAsync(toolRequest.Arguments, cancellationToken),
                _ => BuildFailureOutput(toolName, "TOOL_NOT_IMPLEMENTED", $"Tool '{toolName}' is registered but not implemented in ToolExecutionService."),
            };
        }
        catch (FileNotFoundException ex)
        {
            return BuildFailureOutput(toolName, "FILE_NOT_FOUND", ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BuildFailureOutput(toolName, "INVALID_ARGUMENTS", ex.Message);
        }
        catch (Exception ex)
        {
            return BuildFailureOutput(toolName, "UNEXPECTED_ERROR", ex.Message);
        }
    }

    private async Task<ToolExecutionOutput> ExecuteGetMetadataAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken)
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput("get_metadata", "MISSING_FILE_IDS", "fileIds argument is required and must not be empty.");
        }

        var metadataResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = uploadAudioHandler.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                metadataResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var query = new RunAnalysisQuery(FilePath: filePath);
            var analysisResult = await query.ExecuteAsync(cancellationToken);

            var fileInfo = analysisResult.FileInfo;
            metadataResults.Add(new
            {
                fileId,
                fileName = fileInfo.FileName,
                durationSeconds = fileInfo.DurationSeconds,
                sampleRateHz = fileInfo.SampleRate,
                channels = fileInfo.ChannelCount,
                bitDepth = fileInfo.BitDepth,
            });
        }

        var resultData = new { results = metadataResults };
        return BuildSuccessOutput("get_metadata", "metadata_" + Guid.NewGuid().ToString("N")[..8], resultData);
    }

    private async Task<ToolExecutionOutput> ExecuteRunBasicMetricsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken)
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput("run_basic_metrics", "MISSING_FILE_IDS", "fileIds argument is required and must not be empty.");
        }

        var metricsResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = uploadAudioHandler.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                metricsResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var query = new RunAnalysisQuery(FilePath: filePath);
            var analysisResult = await query.ExecuteAsync(cancellationToken);

            var primaryChannel = GetPrimaryChannel(analysisResult.Level);
            if (primaryChannel is null)
            {
                metricsResults.Add(new { fileId, error = "No channel data available." });
                continue;
            }

            metricsResults.Add(new
            {
                fileId,
                metrics = new
                {
                    rmsDbFs = primaryChannel.RmsDb,
                    peakDbFs = primaryChannel.PeakDb,
                    crestFactorDb = primaryChannel.CrestFactorDb,
                    dcOffsetLinear = primaryChannel.DcOffset,
                },
            });
        }

        var resultData = new { results = metricsResults };
        return BuildSuccessOutput("run_basic_metrics", "basic_metrics_" + Guid.NewGuid().ToString("N")[..8], resultData);
    }

    private async Task<ToolExecutionOutput> ExecuteRunEventDetectionAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken)
    {
        var fileId = ExtractSingleFileId(arguments);
        if (string.IsNullOrEmpty(fileId))
        {
            return BuildFailureOutput("run_event_detection", "MISSING_FILE_ID", "fileId argument is required.");
        }

        var kind = ExtractStringArgument(arguments, "kind") ?? "clipping";
        var validKinds = new[] { "clipping", "silence", "loudest", "transient" };
        var kindIsValid = Array.Exists(validKinds, k => k == kind);
        if (!kindIsValid)
        {
            return BuildFailureOutput("run_event_detection", "INVALID_KIND", $"kind '{kind}' is not valid. Supported: {string.Join(", ", validKinds)}.");
        }

        var filePath = uploadAudioHandler.GetFilePath(fileId);
        if (string.IsNullOrEmpty(filePath))
        {
            return BuildFailureOutput("run_event_detection", "FILE_NOT_FOUND", $"File '{fileId}' not found in storage.");
        }

        var command = new FindEventsCommand(
            Kind: kind,
            FilePath: filePath,
            StartSeconds: null,
            EndSeconds: null);

        var findResult = await command.ExecuteAsync(cancellationToken);

        var resultData = new
        {
            fileId,
            kind = findResult.Kind,
            eventCount = findResult.EventCount,
            events = findResult.Events.Select(e => new
            {
                startSeconds = e.StartSeconds,
                endSeconds = e.EndSeconds,
                durationSeconds = e.DurationSeconds,
                description = e.Description,
            }).ToList(),
        };

        return BuildSuccessOutput("run_event_detection", "events_" + Guid.NewGuid().ToString("N")[..8], resultData);
    }

    private async Task<ToolExecutionOutput> ExecuteRunSpectrumAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken)
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput("run_spectrum", "MISSING_FILE_IDS", "fileIds argument is required and must not be empty.");
        }

        var fftSize = ExtractIntArgument(arguments, "fftSize") ?? DefaultFftSize;
        var overlap = ExtractDoubleArgument(arguments, "overlap") ?? DefaultOverlap;

        var spectrumResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = uploadAudioHandler.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                spectrumResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds = durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;

            var query = new RunSpectrumQuery(
                FilePath: filePath,
                StartSeconds: DefaultSpectrumStartSeconds,
                EndSeconds: effectiveEndSeconds,
                FftSize: fftSize,
                Overlap: overlap);

            var spectrumResult = await query.ExecuteAsync(cancellationToken);

            var primaryChannel = spectrumResult.Channels.Count > 0 ? spectrumResult.Channels[0] : null;
            if (primaryChannel is null)
            {
                spectrumResults.Add(new { fileId, error = "No spectrum channel data." });
                continue;
            }

            var topPeaks = primaryChannel.TonalPeaks
                .OrderByDescending(p => p.ProminenceDb)
                .Take(5)
                .Select(p => new
                {
                    frequencyHz = p.FrequencyHz,
                    magnitudeDb = p.MagnitudeDb,
                    prominenceDb = p.ProminenceDb,
                    confidence = p.Confidence,
                })
                .ToList();

            var dataRef = "spectrum_" + Guid.NewGuid().ToString("N")[..8];

            spectrumResults.Add(new
            {
                fileId,
                summary = new
                {
                    peakFrequencyHz = primaryChannel.PeakFrequencyHz,
                    maxMagnitudeDb = primaryChannel.MaxMagnitudeDb,
                    dominantPeaks = topPeaks,
                },
                parameters = new
                {
                    fftSize = spectrumResult.Parameters.FftSize,
                    windowType = spectrumResult.Parameters.WindowType,
                    overlap = spectrumResult.Parameters.Overlap,
                    blockCount = spectrumResult.Parameters.BlockCount,
                },
                // TODO: Confirm FFT normalization convention.
                // Current implementation returns dBFS magnitude using Hann window coherent-gain correction.
                dataRef,
            });
        }

        var resultData = new { results = spectrumResults };
        return BuildSuccessOutput("run_spectrum", "spectrum_" + Guid.NewGuid().ToString("N")[..8], resultData);
    }

    private async Task<ToolExecutionOutput> ExecuteRunCpbAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken)
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput("run_cpb", "MISSING_FILE_IDS", "fileIds argument is required and must not be empty.");
        }

        var bandMode = ExtractStringArgument(arguments, "bandType") ?? DefaultCpbBandMode;

        var cpbResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = uploadAudioHandler.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                cpbResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds = durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;

            var query = new RunCpbQuery(
                FilePath: filePath,
                StartSeconds: DefaultSpectrumStartSeconds,
                EndSeconds: effectiveEndSeconds,
                BandMode: bandMode,
                FftSize: DefaultFftSize,
                Overlap: DefaultOverlap);

            var cpbResult = await query.ExecuteAsync(cancellationToken);

            var primaryChannel = cpbResult.Channels.Count > 0 ? cpbResult.Channels[0] : null;
            if (primaryChannel is null)
            {
                cpbResults.Add(new { fileId, error = "No CPB channel data." });
                continue;
            }

            var topBands = primaryChannel.Bands
                .OrderByDescending(b => b.LevelDb)
                .Take(5)
                .Select(b => new
                {
                    centerFrequencyHz = b.CenterFrequencyHz,
                    levelDb = b.LevelDb,
                    label = b.Label,
                })
                .ToList();

            var dataRef = "cpb_" + Guid.NewGuid().ToString("N")[..8];

            cpbResults.Add(new
            {
                fileId,
                bandMode,
                // TODO: Current CPB uses FFT-bin power summation. Not IEC 61260 compliant.
                // Label as nominal CPB approximation.
                method = "fft_bin_power_sum (nominal approximation, not IEC 61260)",
                summary = new
                {
                    highestBands = topBands,
                },
                dataRef,
            });
        }

        var resultData = new { results = cpbResults };
        return BuildSuccessOutput("run_cpb", "cpb_" + Guid.NewGuid().ToString("N")[..8], resultData);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private static ChannelLevelAnalysis? GetPrimaryChannel(LevelAnalysis level)
    {
        if (level.Combined is not null)
        {
            return level.Combined;
        }

        return level.Channels.Count > 0 ? level.Channels[0] : null;
    }

    private static double GetFileDurationSeconds(string filePath)
    {
        try
        {
            using var reader = new NAudio.Wave.AudioFileReader(filePath);
            return reader.TotalTime.TotalSeconds;
        }
        catch
        {
            return 0.0;
        }
    }

    private static List<string> ExtractFileIds(Dictionary<string, object?> arguments)
    {
        if (!arguments.TryGetValue("fileIds", out var rawFileIds))
        {
            return [];
        }

        if (rawFileIds is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                var fileIds = new List<string>();
                foreach (var item in jsonElement.EnumerateArray())
                {
                    var stringValue = item.GetString();
                    if (!string.IsNullOrWhiteSpace(stringValue))
                    {
                        fileIds.Add(stringValue.Trim());
                    }
                }
                return fileIds;
            }

            if (jsonElement.ValueKind == JsonValueKind.String)
            {
                var commaSeparated = jsonElement.GetString() ?? string.Empty;
                return SplitCommaSeparatedIds(commaSeparated);
            }
        }

        if (rawFileIds is IEnumerable<string> stringList)
        {
            var fileIds = new List<string>();
            foreach (var item in stringList)
            {
                if (!string.IsNullOrWhiteSpace(item))
                {
                    fileIds.Add(item.Trim());
                }
            }
            return fileIds;
        }

        if (rawFileIds is string rawString)
        {
            return SplitCommaSeparatedIds(rawString);
        }

        return [];
    }

    private static List<string> SplitCommaSeparatedIds(string commaSeparated)
    {
        var result = new List<string>();
        foreach (var part in commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!string.IsNullOrWhiteSpace(part))
            {
                result.Add(part);
            }
        }
        return result;
    }

    private static string? ExtractSingleFileId(Dictionary<string, object?> arguments)
    {
        if (!arguments.TryGetValue("fileId", out var rawFileId))
        {
            return null;
        }

        if (rawFileId is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.String)
        {
            return jsonElement.GetString();
        }

        return rawFileId?.ToString();
    }

    private static string? ExtractStringArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (rawValue is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.String)
        {
            return jsonElement.GetString();
        }

        return rawValue?.ToString();
    }

    private static int? ExtractIntArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (rawValue is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetInt32(out var intValue))
            {
                return intValue;
            }
        }

        return null;
    }

    private static double? ExtractDoubleArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (rawValue is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetDouble(out var doubleValue))
            {
                return doubleValue;
            }
        }

        return null;
    }

    private static ToolExecutionOutput BuildSuccessOutput(string toolName, string resultRef, object resultData)
    {
        return new ToolExecutionOutput
        {
            ToolName = toolName,
            Status = "completed",
            ResultRef = resultRef,
            ResultData = resultData,
        };
    }

    private static ToolExecutionOutput BuildFailureOutput(string toolName, string errorCode, string errorMessage)
    {
        return new ToolExecutionOutput
        {
            ToolName = toolName,
            Status = "failed",
            ResultRef = string.Empty,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
        };
    }
}
