using System.Text.Json;
using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class ToolExecutionService(
    AudioFileRepository audioFileRepository,
    SoundQualityAnalysisService soundQualityAnalysisService,
    IReadOnlyList<ISignalFileImporter> signalFileImporters,
    SpectrogramCacheStore spectrogramCacheStore
)
{
    private const double DefaultSpectrumStartSeconds = 0.0;
    private const double DefaultSpectrumEndFallback = 600.0;
    private const int DefaultFftSize = 32768;
    private const double DefaultOverlap = 0.5;
    private const int DefaultSpectrogramFftSize = 2048;
    private const double DefaultSpectrogramOverlap = 0.75;
    private const string DefaultSpectrogramScale = "mel";
    private const double DefaultSpectrogramGainDb = 20.0;
    private const double DefaultSpectrogramRangeDb = 80.0;
    private const string DefaultCpbBandMode = "third_octave";

    public async Task<ToolExecutionOutput> ExecuteToolAsync(
        PlannerToolRequest toolRequest,
        CancellationToken cancellationToken
    )
    {
        var toolName = toolRequest.Name;
        var startedAtUtc = DateTime.UtcNow;

        if (!AgentToolRegistry.IsToolAllowed(toolName))
        {
            return BuildFailureOutput(
                toolName,
                "TOOL_NOT_ALLOWED",
                $"Tool '{toolName}' is not in the allowed tools registry.",
                startedAtUtc,
                DateTime.UtcNow
            );
        }

        try
        {
            ToolExecutionOutput result = toolName switch
            {
                "get_metadata" => await ExecuteGetMetadataAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_basic_metrics" => await ExecuteRunBasicMetricsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_event_detection" => await ExecuteRunEventDetectionAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_spectrum" => await ExecuteRunSpectrumAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_spectrogram" => await ExecuteRunSpectrogramAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_cpb" => await ExecuteRunCpbAsync(toolRequest.Arguments, cancellationToken),
                "run_sound_quality_metrics" => await ExecuteRunSoundQualityMetricsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                "run_findings" => await ExecuteRunFindingsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                _ => BuildFailureOutput(
                    toolName,
                    "TOOL_NOT_IMPLEMENTED",
                    $"Tool '{toolName}' is registered but not implemented in ToolExecutionService.",
                    startedAtUtc,
                    DateTime.UtcNow
                ),
            };

            return BuildSuccessOutputWithTiming(result, startedAtUtc, DateTime.UtcNow);
        }
        catch (FileNotFoundException ex)
        {
            return BuildFailureOutput(
                toolName,
                "FILE_NOT_FOUND",
                ex.Message,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
        catch (ArgumentException ex)
        {
            return BuildFailureOutput(
                toolName,
                "INVALID_ARGUMENTS",
                ex.Message,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            return BuildFailureOutput(
                toolName,
                "UNEXPECTED_ERROR",
                ex.Message,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
    }

    private async Task<ToolExecutionOutput> ExecuteGetMetadataAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput(
                "get_metadata",
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var metadataResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                metadataResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var query = new RunAnalysisQuery(FilePath: filePath);
            var analysisResult = await query.ExecuteAsync(cancellationToken);

            var fileInfo = analysisResult.FileInfo;
            metadataResults.Add(
                new
                {
                    fileId,
                    fileName = fileInfo.FileName,
                    durationSeconds = fileInfo.DurationSeconds,
                    sampleRateHz = fileInfo.SampleRate,
                    channels = fileInfo.ChannelCount,
                    bitDepth = fileInfo.BitDepth,
                }
            );
        }

        var resultData = new { results = metadataResults };
        return BuildSuccessOutput(
            "get_metadata",
            "metadata_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunBasicMetricsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput(
                "run_basic_metrics",
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var metricsResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
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

            metricsResults.Add(
                new
                {
                    fileId,
                    metrics = new
                    {
                        rmsDbFs = primaryChannel.RmsDb,
                        peakDbFs = primaryChannel.PeakDb,
                        crestFactorDb = primaryChannel.CrestFactorDb,
                        dcOffsetLinear = primaryChannel.DcOffset,
                    },
                }
            );
        }

        var resultData = new { results = metricsResults };
        return BuildSuccessOutput(
            "run_basic_metrics",
            "basic_metrics_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunEventDetectionAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileId = ExtractSingleFileId(arguments);
        if (string.IsNullOrEmpty(fileId))
        {
            return BuildFailureOutput(
                "run_event_detection",
                "MISSING_FILE_ID",
                "fileId argument is required."
            );
        }

        var kind = ExtractStringArgument(arguments, "kind") ?? "clipping";
        var validKinds = new[] { "clipping", "silence", "loudest", "transient" };
        var kindIsValid = Array.Exists(validKinds, k => k == kind);
        if (!kindIsValid)
        {
            return BuildFailureOutput(
                "run_event_detection",
                "INVALID_KIND",
                $"kind '{kind}' is not valid. Supported: {string.Join(", ", validKinds)}."
            );
        }

        var filePath = audioFileRepository.GetFilePath(fileId);
        if (string.IsNullOrEmpty(filePath))
        {
            return BuildFailureOutput(
                "run_event_detection",
                "FILE_NOT_FOUND",
                $"File '{fileId}' not found in storage."
            );
        }

        var command = new FindEventsCommand(
            Kind: kind,
            FilePath: filePath,
            StartSeconds: null,
            EndSeconds: null
        );

        var findResult = await command.ExecuteAsync(cancellationToken);

        var resultData = new
        {
            fileId,
            kind = findResult.Kind,
            eventCount = findResult.EventCount,
            events = findResult
                .Events.Select(e => new
                {
                    startSeconds = e.StartSeconds,
                    endSeconds = e.EndSeconds,
                    durationSeconds = e.DurationSeconds,
                    description = e.Description,
                })
                .ToList(),
        };

        return BuildSuccessOutput(
            "run_event_detection",
            "events_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunSpectrumAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput(
                "run_spectrum",
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var fftSize = ExtractIntArgument(arguments, "fftSize") ?? DefaultFftSize;
        var overlap = ExtractDoubleArgument(arguments, "overlap") ?? DefaultOverlap;

        var spectrumResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                spectrumResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds =
                durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;

            var query = new RunSpectrumQuery(
                FilePath: filePath,
                StartSeconds: DefaultSpectrumStartSeconds,
                EndSeconds: effectiveEndSeconds,
                FftSize: fftSize,
                Overlap: overlap
            );

            var spectrumResult = await query.ExecuteAsync(cancellationToken);

            var primaryChannel =
                spectrumResult.Channels.Count > 0 ? spectrumResult.Channels[0] : null;
            if (primaryChannel is null)
            {
                spectrumResults.Add(new { fileId, error = "No spectrum channel data." });
                continue;
            }

            var topPeaks = primaryChannel
                .TonalPeaks.OrderByDescending(p => p.ProminenceDb)
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

            spectrumResults.Add(
                new
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
                    // FFT normalization: one-sided amplitude with Hann window coherent-gain correction.
                    // Pressure channels are converted to dB SPL (dB re 20 µPa) via AcousticPressureConverter.
                    dataRef,
                }
            );
        }

        var resultData = new { results = spectrumResults };
        return BuildSuccessOutput(
            "run_spectrum",
            "spectrum_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunCpbAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput(
                "run_cpb",
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var bandMode = ExtractStringArgument(arguments, "bandType") ?? DefaultCpbBandMode;
        var weighting = ExtractStringArgument(arguments, "weighting") ?? "z";

        var cpbResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                cpbResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds =
                durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;

            var query = new RunCpbQuery(
                FilePath: filePath,
                StartSeconds: DefaultSpectrumStartSeconds,
                EndSeconds: effectiveEndSeconds,
                BandMode: bandMode,
                FftSize: DefaultFftSize,
                Overlap: DefaultOverlap,
                Weighting: weighting,
                Method: "fft_bin_power_sum"
            );

            var cpbResult = await query.ExecuteAsync(cancellationToken);

            var primaryChannel = cpbResult.Channels.Count > 0 ? cpbResult.Channels[0] : null;
            if (primaryChannel is null)
            {
                cpbResults.Add(new { fileId, error = "No CPB channel data." });
                continue;
            }

            var topBands = primaryChannel
                .Bands.OrderByDescending(b => b.LevelDb)
                .Take(5)
                .Select(b => new
                {
                    centerFrequencyHz = b.CenterFrequencyHz,
                    levelDb = b.LevelDb,
                    label = b.Label,
                })
                .ToList();

            var dataRef = "cpb_" + Guid.NewGuid().ToString("N")[..8];

            cpbResults.Add(
                new
                {
                    fileId,
                    bandMode,
                    weighting = cpbResult.Parameters.Weighting,
                    weightingMethod = cpbResult.Parameters.WeightingMethod,
                    // TODO: Current CPB uses FFT-bin power summation. Not IEC 61260 compliant.
                    // Label as nominal CPB approximation.
                    method = "fft_bin_power_sum (nominal approximation, not IEC 61260)",
                    summary = new { highestBands = topBands },
                    dataRef,
                }
            );
        }

        var resultData = new { results = cpbResults };
        return BuildSuccessOutput(
            "run_cpb",
            "cpb_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private Task<ToolExecutionOutput> ExecuteRunSpectrogramAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return Task.FromResult(
                BuildFailureOutput(
                    "run_spectrogram",
                    "MISSING_FILE_IDS",
                    "fileIds argument is required and must not be empty."
                )
            );
        }

        var spectrogramResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                spectrogramResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds =
                durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;

            var query = new RunSpectrogramQuery(
                FilePath: filePath,
                StartSeconds: DefaultSpectrumStartSeconds,
                EndSeconds: effectiveEndSeconds,
                FftSize: DefaultSpectrogramFftSize,
                Overlap: DefaultSpectrogramOverlap,
                Scale: DefaultSpectrogramScale,
                GainDb: DefaultSpectrogramGainDb,
                RangeDb: DefaultSpectrogramRangeDb
            );

            var spectrogramResult = RunSpectrogramAnalysis(query, cancellationToken);
            var primaryChannel =
                spectrogramResult.Channels.Count > 0 ? spectrogramResult.Channels[0] : null;
            if (primaryChannel is null)
            {
                spectrogramResults.Add(new { fileId, error = "No spectrogram channel data." });
                continue;
            }

            var dataRef = "spectrogram_" + Guid.NewGuid().ToString("N")[..8];

            spectrogramResults.Add(
                new
                {
                    fileId,
                    region = new
                    {
                        startSeconds = spectrogramResult.Region.StartSeconds,
                        endSeconds = spectrogramResult.Region.EndSeconds,
                        durationSeconds = spectrogramResult.Region.DurationSeconds,
                    },
                    parameters = new
                    {
                        fftSize = spectrogramResult.Parameters.FftSize,
                        windowType = spectrogramResult.Parameters.WindowType,
                        overlap = spectrogramResult.Parameters.Overlap,
                        scale = spectrogramResult.Parameters.Scale,
                        gainDb = spectrogramResult.Parameters.GainDb,
                        rangeDb = spectrogramResult.Parameters.RangeDb,
                        sampleRate = spectrogramResult.Parameters.SampleRate,
                    },
                    summary = new
                    {
                        frameCount = primaryChannel.FrameCount,
                        binCount = primaryChannel.BinCount,
                        nyquistHz = primaryChannel.NyquistHz,
                    },
                    dataRef,
                }
            );
        }

        var resultData = new { results = spectrogramResults };
        return Task.FromResult(
            BuildSuccessOutput(
                "run_spectrogram",
                "spectrogram_" + Guid.NewGuid().ToString("N")[..8],
                resultData
            )
        );
    }

    private SpectrogramAnalysis RunSpectrogramAnalysis(
        RunSpectrogramQuery query,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (
            spectrogramCacheStore.TryGet(
                query.FilePath,
                query.StartSeconds,
                query.EndSeconds,
                query.FftSize,
                query.Overlap,
                query.Scale,
                query.GainDb,
                query.RangeDb,
                query.MinDbSpl,
                query.MaxDbSpl,
                out var cached
            ) && cached is not null
        )
        {
            return cached;
        }

        var importer = ResolveSignalImporter(query.FilePath);
        var signalFile = importer.Import(query.FilePath);
        var result = SpectrogramAnalyzer.Analyze(
            signalFile.Channels,
            query.StartSeconds,
            query.EndSeconds,
            query.FftSize,
            query.Overlap,
            query.Scale,
            query.GainDb,
            query.RangeDb,
            query.MinDbSpl,
            query.MaxDbSpl
        );

        spectrogramCacheStore.Set(
            query.FilePath,
            query.StartSeconds,
            query.EndSeconds,
            query.FftSize,
            query.Overlap,
            query.Scale,
            query.GainDb,
            query.RangeDb,
            query.MinDbSpl,
            query.MaxDbSpl,
            result
        );

        return result;
    }

    private ISignalFileImporter ResolveSignalImporter(string filePath)
    {
        foreach (var importer in signalFileImporters)
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

    private async Task<ToolExecutionOutput> ExecuteRunSoundQualityMetricsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return BuildFailureOutput(
                "run_sound_quality_metrics",
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var soundQualityResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                soundQualityResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            var durationSeconds = GetFileDurationSeconds(filePath);
            var effectiveEndSeconds =
                durationSeconds > 0 ? durationSeconds : DefaultSpectrumEndFallback;
            var query = new RunSoundQualityQuery(
                FilePath: filePath,
                StartSeconds: 0.0,
                EndSeconds: effectiveEndSeconds,
                Method: "mosqito_stationary_zwicker"
            );

            var soundQualityResult = await soundQualityAnalysisService.AnalyzeAsync(
                query,
                cancellationToken
            );

            soundQualityResults.Add(
                new
                {
                    fileId,
                    region = new
                    {
                        startSeconds = soundQualityResult.Region.StartSeconds,
                        endSeconds = soundQualityResult.Region.EndSeconds,
                        durationSeconds = soundQualityResult.Region.DurationSeconds,
                    },
                    method = soundQualityResult.Parameters.Method,
                    limitations = soundQualityResult.Parameters.Limitations,
                    loudness = new
                    {
                        value = soundQualityResult.Loudness.Value,
                        unit = soundQualityResult.Loudness.Unit,
                        method = soundQualityResult.Loudness.Method,
                    },
                    sharpness = new
                    {
                        value = soundQualityResult.Sharpness.Value,
                        unit = soundQualityResult.Sharpness.Unit,
                        method = soundQualityResult.Sharpness.Method,
                    },
                    roughness = new
                    {
                        value = soundQualityResult.Roughness.Value,
                        unit = soundQualityResult.Roughness.Unit,
                        method = soundQualityResult.Roughness.Method,
                    },
                }
            );
        }

        var resultData = new { results = soundQualityResults };
        return BuildSuccessOutput(
            "run_sound_quality_metrics",
            "sound_quality_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunFindingsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileId = ExtractSingleFileId(arguments);
        if (string.IsNullOrEmpty(fileId))
        {
            return BuildFailureOutput(
                "run_findings",
                "MISSING_FILE_ID",
                "fileId argument is required."
            );
        }

        var filePath = audioFileRepository.GetFilePath(fileId);
        if (string.IsNullOrEmpty(filePath))
        {
            return BuildFailureOutput(
                "run_findings",
                "FILE_NOT_FOUND",
                $"File '{fileId}' not found in storage."
            );
        }

        var command = new RunFindingsCommand(FilePath: filePath);
        var findingsResult = await command.ExecuteAsync(cancellationToken);

        var resultData = new
        {
            fileId,
            findingCount = findingsResult.FindingCount,
            ranAt = findingsResult.RanAt,
            findings = findingsResult
                .Findings.Select(f => new
                {
                    findingId = f.FindingId,
                    type = f.Type,
                    severity = f.Severity,
                    confidence = f.Confidence,
                    title = f.Title,
                    description = f.Description,
                    suggestedNextStep = f.SuggestedNextStep,
                    startSeconds = f.StartSeconds,
                    endSeconds = f.EndSeconds,
                    frequencyHz = f.FrequencyHz,
                    evidence = f.Evidence,
                })
                .ToList(),
        };

        return BuildSuccessOutput(
            "run_findings",
            "findings_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
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
        foreach (
            var part in commaSeparated.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
        )
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
            if (
                jsonElement.ValueKind == JsonValueKind.Number
                && jsonElement.TryGetInt32(out var intValue)
            )
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
            if (
                jsonElement.ValueKind == JsonValueKind.Number
                && jsonElement.TryGetDouble(out var doubleValue)
            )
            {
                return doubleValue;
            }
        }

        return null;
    }

    private static ToolExecutionOutput BuildSuccessOutput(
        string toolName,
        string resultRef,
        object resultData
    )
    {
        return new ToolExecutionOutput
        {
            ToolName = toolName,
            Status = "completed",
            ResultRef = resultRef,
            ResultData = resultData,
            StartedAtUtc = null,
            FinishedAtUtc = null,
        };
    }

    private static ToolExecutionOutput BuildSuccessOutputWithTiming(
        ToolExecutionOutput output,
        DateTime startedAtUtc,
        DateTime finishedAtUtc
    )
    {
        return new ToolExecutionOutput
        {
            ToolName = output.ToolName,
            Status = output.Status,
            ResultRef = output.ResultRef,
            ResultData = output.ResultData,
            ErrorCode = output.ErrorCode,
            ErrorMessage = output.ErrorMessage,
            StartedAtUtc = startedAtUtc,
            FinishedAtUtc = finishedAtUtc,
        };
    }

    private static ToolExecutionOutput BuildFailureOutput(
        string toolName,
        string errorCode,
        string errorMessage,
        DateTime? startedAtUtc = null,
        DateTime? finishedAtUtc = null
    )
    {
        return new ToolExecutionOutput
        {
            ToolName = toolName,
            Status = "failed",
            ResultRef = string.Empty,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            StartedAtUtc = startedAtUtc,
            FinishedAtUtc = finishedAtUtc,
        };
    }
}
