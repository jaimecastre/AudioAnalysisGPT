using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunCompareHandler(
    SignalAnalysisService analysisService,
    SoundQualityAnalysisService soundQualityAnalysisService
) : CommandHandler<RunCompareCommand, CompareResult>
{
    private const int DefaultFftSize = 44100;
    private const double DefaultOverlap = 0.5;
    private const int MaxConcurrentFileSummaries = 16;

    private readonly SemaphoreSlim _summarySemaphore = new(MaxConcurrentFileSummaries, MaxConcurrentFileSummaries);

    public override async Task<CompareResult> ExecuteAsync(
        RunCompareCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (command.FilePaths.Count < 2)
        {
            throw new ArgumentException("At least two files are required for comparison.");
        }

        for (int index = 0; index < command.FilePaths.Count; index++)
        {
            if (!File.Exists(command.FilePaths[index]))
            {
                throw new FileNotFoundException(
                    $"Audio file {index + 1} not found: {command.FilePaths[index]}"
                );
            }
        }

        var summaryTasks = command
            .FilePaths.Select(async filePath =>
            {
                await _summarySemaphore.WaitAsync(ct);
                try
                {
                    return await BuildFileSummaryAsync(filePath, command.StartSeconds, command.EndSeconds, ct);
                }
                finally
                {
                    _summarySemaphore.Release();
                }
            })
            .ToArray();
        var summaries = await Task.WhenAll(summaryTasks);

        if (command.SkipPairwiseDiffs)
        {
            return new CompareResult
            {
                Files = summaries,
                PairwiseDiffs = [],
                RanAt = DateTimeOffset.UtcNow,
            };
        }

        var pairwiseDiffs = new List<PairwiseDiff>();
        for (int i = 0; i < summaries.Length; i++)
        {
            for (int j = i + 1; j < summaries.Length; j++)
            {
                var a = summaries[i];
                var b = summaries[j];
                var spectrumDelta = CompareResultBuilder.BuildSpectrumDelta(
                    a.SpectrumCurve,
                    b.SpectrumCurve
                );
                var bandEnergyDeltas = CompareResultBuilder.BuildBandEnergyDeltas(
                    a.BandEnergies,
                    b.BandEnergies
                );
                var cpbBandDeltas = CompareResultBuilder.BuildCpbBandDeltas(a.CpbBands, b.CpbBands);
                var (soundQualityDelta, soundQualityUnavailableReason) =
                    CompareSoundQualityBuilder.BuildDeltaAndUnavailableReason(a, b);

                pairwiseDiffs.Add(
                    new PairwiseDiff
                    {
                        FileIdA = a.FileId,
                        FileIdB = b.FileId,
                        PeakDeltaDb = b.PeakDb - a.PeakDb,
                        HigherPeakFileId = a.PeakDb >= b.PeakDb ? a.FileId : b.FileId,
                        RmsDeltaDb = b.RmsDb - a.RmsDb,
                        HigherRmsFileId = a.RmsDb >= b.RmsDb ? a.FileId : b.FileId,
                        CrestFactorDeltaDb = b.CrestFactorDb - a.CrestFactorDb,
                        HigherCrestFactorFileId =
                            a.CrestFactorDb >= b.CrestFactorDb ? a.FileId : b.FileId,
                        PeakFrequencyDeltaHz = b.PeakFrequencyHz - a.PeakFrequencyHz,
                        HigherPeakFrequencyFileId =
                            a.PeakFrequencyHz >= b.PeakFrequencyHz ? a.FileId : b.FileId,
                        SpectrumDelta = spectrumDelta,
                        BandEnergyDeltas = bandEnergyDeltas,
                        CpbBandDeltas = cpbBandDeltas,
                        SoundQualityDelta = soundQualityDelta,
                        SoundQualityUnavailableReason = soundQualityUnavailableReason,
                    }
                );
            }
        }

        return new CompareResult
        {
            Files = summaries,
            PairwiseDiffs = pairwiseDiffs,
            RanAt = DateTimeOffset.UtcNow,
        };
    }

    private async Task<CompareFileSummary> BuildFileSummaryAsync(
        string filePath,
        double? startSeconds,
        double? endSeconds,
        CancellationToken ct
    )
    {
        var signalFile = analysisService.ImportFile(filePath);
        var duration = signalFile.FileInfo.DurationSeconds;
        var resolvedStart = startSeconds ?? 0.0;
        var resolvedEnd = endSeconds ?? duration;

        // Launch Python concurrently so its startup overlaps the synchronous DSP work below.
        var sqQuery = new RunSoundQualityQuery(
            FilePath: filePath,
            StartSeconds: resolvedStart,
            EndSeconds: resolvedEnd,
            Method: "mosqito_stationary_zwicker"
        );
        var sqTask = soundQualityAnalysisService.AnalyzeAsync(sqQuery, ct);

        var levelAnalysis = LevelAnalyzer.Analyze(signalFile.Channels, resolvedStart, resolvedEnd);
        var firstLevelChannel = levelAnalysis.Channels.Count > 0 ? levelAnalysis.Channels[0] : null;
        var peakDb = firstLevelChannel?.PeakDb ?? 0.0;
        var rmsDb = firstLevelChannel?.RmsDb ?? 0.0;
        var crestFactorDb = firstLevelChannel?.CrestFactorDb ?? 0.0;

        var spectrumAnalysis = SpectrumAnalyzer.Analyze(
            signalFile.Channels,
            resolvedStart,
            resolvedEnd,
            DefaultFftSize,
            DefaultOverlap
        );

        var firstSpectrumChannel =
            spectrumAnalysis.Channels.Count > 0 ? spectrumAnalysis.Channels[0] : null;
        var peakFrequencyHz = firstSpectrumChannel?.PeakFrequencyHz ?? 0.0;
        var peakFrequencyMagnitudeDb = firstSpectrumChannel?.MaxMagnitudeDb ?? 0.0;

        var spectrumCurve = CompareResultBuilder.BuildSpectrumCurve(firstSpectrumChannel);
        var bandEnergies = CompareResultBuilder.ComputeBandEnergies(firstSpectrumChannel);
        var sampleRate = signalFile.Channels.Count > 0 ? signalFile.Channels[0].SampleRate : 0;
        var cpbBands = CompareResultBuilder.ComputeCpbBands(
            spectrumAnalysis,
            resolvedStart,
            resolvedEnd,
            sampleRate
        );

        CompareSoundQuality? soundQuality = null;
        string? soundQualityUnavailableReason = null;
        try
        {
            var sqResult = await sqTask;
            soundQuality = new CompareSoundQuality
            {
                LoudnessSone = sqResult.Loudness.Value,
                SharpnessAcum = sqResult.Sharpness.Value,
                RoughnessAsper = sqResult.Roughness.Value,
                Method = sqResult.Parameters.Method,
            };
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            // Keep compare flow deterministic when the sidecar is unavailable.
            soundQualityUnavailableReason =
                "Sound-quality metrics unavailable for this file (Python sidecar unavailable or sound-quality analysis failed).";
        }

        var storedFileName = Path.GetFileName(filePath);
        var displayFileName =
            storedFileName.Length > 13 && storedFileName[12] == '_'
                ? storedFileName[13..]
                : storedFileName;

        return new CompareFileSummary
        {
            FileId = filePath,
            FileName = displayFileName,
            PeakDb = peakDb,
            RmsDb = rmsDb,
            CrestFactorDb = crestFactorDb,
            PeakFrequencyHz = peakFrequencyHz,
            PeakFrequencyMagnitudeDb = peakFrequencyMagnitudeDb,
            RegionStartSeconds = resolvedStart,
            RegionEndSeconds = resolvedEnd,
            SpectrumCurve = spectrumCurve,
            BandEnergies = bandEnergies,
            CpbBands = cpbBands,
            SoundQuality = soundQuality,
            SoundQualityUnavailableReason = soundQualityUnavailableReason,
            DbUnit = firstLevelChannel?.DbUnit,
        };
    }
}
