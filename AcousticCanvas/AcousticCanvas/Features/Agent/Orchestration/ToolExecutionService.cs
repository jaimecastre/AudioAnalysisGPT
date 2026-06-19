using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Endpoints;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class ToolExecutionService(
    AudioFileRepository audioFileRepository,
    SignalAnalysisService signalAnalysisService,
    SoundQualityAnalysisService soundQualityAnalysisService,
    IReadOnlyList<ISignalFileImporter> signalFileImporters,
    SpectrogramCacheStore spectrogramCacheStore,
    AnalysisResultCache analysisResultCache
)
{
    private const double DefaultSpectrumStartSeconds = 0.0;
    private const double DefaultSpectrumEndFallback = 600.0;
    private const int DefaultFftSize = 44100;
    private const double DefaultOverlap = 0.677;
    private const int DefaultSpectrogramFftSize = 44100;
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
            return ToolOutputBuilder.BuildFailureOutput(
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
                AgentToolNames.GetMetadata => await ExecuteGetMetadataAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunBasicMetrics => await ExecuteRunBasicMetricsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunEventDetection => await ExecuteRunEventDetectionAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunSpectrum => await ExecuteRunSpectrumAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunSpectrogram => await ExecuteRunSpectrogramAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunCpb => await ExecuteRunCpbAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunSoundQualityMetrics => await ExecuteRunSoundQualityMetricsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                AgentToolNames.RunFindings => await ExecuteRunFindingsAsync(
                    toolRequest.Arguments,
                    cancellationToken
                ),
                _ => ToolOutputBuilder.BuildFailureOutput(
                    toolName,
                    "TOOL_NOT_IMPLEMENTED",
                    $"Tool '{toolName}' is registered but not implemented in ToolExecutionService.",
                    startedAtUtc,
                    DateTime.UtcNow
                ),
            };

            return ToolOutputBuilder.BuildSuccessOutputWithTiming(
                result,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
        catch (FileNotFoundException ex)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                toolName,
                "FILE_NOT_FOUND",
                ex.Message,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
        catch (ArgumentException ex)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                toolName,
                "INVALID_ARGUMENTS",
                ex.Message,
                startedAtUtc,
                DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            return ToolOutputBuilder.BuildFailureOutput(
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
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.GetMetadata,
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
        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.GetMetadata,
            "metadata_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunBasicMetricsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunBasicMetrics,
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var startSeconds = ToolArgumentParser.ExtractDoubleArgument(arguments, "startSeconds");
        var endSeconds = ToolArgumentParser.ExtractDoubleArgument(arguments, "endSeconds");
        var hasTimeRange = startSeconds.HasValue || endSeconds.HasValue;

        var metricsResults = new List<object>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (string.IsNullOrEmpty(filePath))
            {
                metricsResults.Add(new { fileId, error = "File not found in storage." });
                continue;
            }

            LevelAnalysis levelAnalysis;
            if (hasTimeRange)
            {
                var signalFile = signalAnalysisService.ImportFile(filePath);
                var effectiveStart = startSeconds ?? 0.0;
                var effectiveEnd = endSeconds ?? signalFile.FileInfo.DurationSeconds;
                levelAnalysis = LevelAnalyzer.Analyze(
                    signalFile.Channels,
                    effectiveStart,
                    effectiveEnd
                );
            }
            else
            {
                var query = new RunAnalysisQuery(FilePath: filePath);
                var analysisResult = await query.ExecuteAsync(cancellationToken);
                levelAnalysis = analysisResult.Level;
            }

            var primaryChannel = GetPrimaryChannel(levelAnalysis);
            if (primaryChannel is null)
            {
                metricsResults.Add(new { fileId, error = "No channel data available." });
                continue;
            }

            metricsResults.Add(
                new
                {
                    fileId,
                    region = hasTimeRange
                        ? new { startSeconds = startSeconds ?? 0.0, endSeconds }
                        : (object?)null,
                    metrics = new
                    {
                        rmsDbFs = primaryChannel.RmsDb,
                        peakDbFs = primaryChannel.PeakDb,
                        crestFactorDb = primaryChannel.CrestFactorDb,
                        dcOffsetLinear = primaryChannel.DcOffset,
                        dbUnit = primaryChannel.DbUnit,
                    },
                }
            );
        }

        var resultData = new { results = metricsResults };
        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunBasicMetrics,
            "basic_metrics_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunEventDetectionAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileId = ToolArgumentParser.ExtractSingleFileId(arguments);
        if (string.IsNullOrEmpty(fileId))
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunEventDetection,
                "MISSING_FILE_ID",
                "fileId argument is required."
            );
        }

        var kind = ToolArgumentParser.ExtractStringArgument(arguments, "kind") ?? "clipping";
        var validKinds = new[] { "clipping", "silence", "loudest", "transient" };
        var kindIsValid = Array.Exists(validKinds, k => k == kind);
        if (!kindIsValid)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunEventDetection,
                "INVALID_KIND",
                $"kind '{kind}' is not valid. Supported: {string.Join(", ", validKinds)}."
            );
        }

        var filePath = audioFileRepository.GetFilePath(fileId);
        if (string.IsNullOrEmpty(filePath))
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunEventDetection,
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

        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunEventDetection,
            "events_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunSpectrumAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunSpectrum,
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var fftSize = ToolArgumentParser.ExtractIntArgument(arguments, "fftSize") ?? DefaultFftSize;
        var overlap =
            ToolArgumentParser.ExtractDoubleArgument(arguments, "overlap") ?? DefaultOverlap;
        var requestedStart = ToolArgumentParser.ExtractDoubleArgument(arguments, "startSeconds");
        var requestedEnd = ToolArgumentParser.ExtractDoubleArgument(arguments, "endSeconds");

        var spectrumResults = new List<object>();
        var storedResultIds = new List<string>();

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

            var queryStart = requestedStart ?? DefaultSpectrumStartSeconds;
            var queryEnd = requestedEnd ?? effectiveEndSeconds;

            var query = new RunSpectrumQuery(
                FilePath: filePath,
                StartSeconds: queryStart,
                EndSeconds: queryEnd,
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

            // Convert to points response format for storage
            var pointsResponse = SpectrumPointsMapper.ToPointsResponse(spectrumResult);
            var resultId = analysisResultCache.StoreResult(pointsResponse, "spectrum");
            storedResultIds.Add(resultId);

            spectrumResults.Add(
                new
                {
                    fileId,
                    region = (requestedStart.HasValue || requestedEnd.HasValue)
                        ? new { startSeconds = queryStart, endSeconds = queryEnd }
                        : (object?)null,
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
                    // Reference to full result for AnalysisViewBlock modal
                    resultId,
                }
            );
        }

        var resultData = new { results = spectrumResults, storedResultIds };
        var primaryResultId = storedResultIds.FirstOrDefault() ?? $"spectrum_{Guid.NewGuid():N}";
        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunSpectrum,
            primaryResultId,
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunCpbAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunCpb,
                "MISSING_FILE_IDS",
                "fileIds argument is required and must not be empty."
            );
        }

        var bandMode =
            ToolArgumentParser.ExtractStringArgument(arguments, "bandType") ?? DefaultCpbBandMode;
        var weighting = ToolArgumentParser.ExtractStringArgument(arguments, "weighting") ?? "z";

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
                    parameters = new
                    {
                        fftSize = cpbResult.Parameters.FftSize,
                        windowType = cpbResult.Parameters.WindowType,
                        overlap = cpbResult.Parameters.Overlap,
                        blockCount = cpbResult.Parameters.BlockCount,
                    },
                    summary = new { highestBands = topBands },
                    dataRef,
                }
            );
        }

        var resultData = new { results = cpbResults };
        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunCpb,
            "cpb_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private Task<ToolExecutionOutput> ExecuteRunSpectrogramAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return Task.FromResult(
                ToolOutputBuilder.BuildFailureOutput(
                    AgentToolNames.RunSpectrogram,
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

            var resultId = analysisResultCache.StoreResult(spectrogramResult, "spectrogram");
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
                    resultId,
                }
            );
        }

        var resultData = new { results = spectrogramResults };
        return Task.FromResult(
            ToolOutputBuilder.BuildSuccessOutput(
                AgentToolNames.RunSpectrogram,
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
        var fileIds = ToolArgumentParser.ExtractFileIds(arguments);
        if (fileIds.Count == 0)
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunSoundQualityMetrics,
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
        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunSoundQualityMetrics,
            "sound_quality_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private async Task<ToolExecutionOutput> ExecuteRunFindingsAsync(
        Dictionary<string, object?> arguments,
        CancellationToken cancellationToken
    )
    {
        var fileId = ToolArgumentParser.ExtractSingleFileId(arguments);
        if (string.IsNullOrEmpty(fileId))
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunFindings,
                "MISSING_FILE_ID",
                "fileId argument is required."
            );
        }

        var filePath = audioFileRepository.GetFilePath(fileId);
        if (string.IsNullOrEmpty(filePath))
        {
            return ToolOutputBuilder.BuildFailureOutput(
                AgentToolNames.RunFindings,
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

        return ToolOutputBuilder.BuildSuccessOutput(
            AgentToolNames.RunFindings,
            "findings_" + Guid.NewGuid().ToString("N")[..8],
            resultData
        );
    }

    private static ChannelLevelAnalysis? GetPrimaryChannel(LevelAnalysis level)
    {
        if (level.Channels.Count == 0)
        {
            return null;
        }

        return level.Channels[0];
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
}
