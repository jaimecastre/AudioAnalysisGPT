using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunAgentAnalysisHandler(SignalAnalysisService analysisService)
    : CommandHandler<RunAgentAnalysisCommand, AgentAnalysisResult>
{
    private const int DefaultFftSize = 8192;
    private const double DefaultOverlap = 0.5;

    public override async Task<AgentAnalysisResult> ExecuteAsync(RunAgentAnalysisCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(command.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {command.FilePath}");
        }

        if (command.Kind == "file_info")
        {
            return await RunFileInfoAnalysis(command, ct);
        }

        if (command.Kind == "level")
        {
            return await RunLevelAnalysis(command, ct);
        }

        if (command.Kind == "spectrum")
        {
            return await RunSpectrumAnalysis(command, ct);
        }

        throw new ArgumentException($"Unknown analysis kind: '{command.Kind}'. Supported values: file_info, level, spectrum.");
    }

    private Task<AgentAnalysisResult> RunFileInfoAnalysis(RunAgentAnalysisCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var fullResult = analysisService.Analyze(command.FilePath);
        var fileInfo = fullResult.FileInfo;

        var summary = new Dictionary<string, object?>
        {
            ["fileName"] = fileInfo.FileName,
            ["containerFormat"] = fileInfo.ContainerFormat,
            ["encodingFormat"] = fileInfo.EncodingFormat,
            ["durationSeconds"] = fileInfo.DurationSeconds,
            ["sampleRate"] = fileInfo.SampleRate,
            ["channelCount"] = fileInfo.ChannelCount,
            ["bitDepth"] = fileInfo.BitDepth,
            ["fileSizeBytes"] = fileInfo.FileSizeBytes,
            ["totalFrames"] = fileInfo.TotalFrames,
        };

        var result = new AgentAnalysisResult
        {
            Kind = "file_info",
            FileId = command.FilePath,
            RegionStart = command.StartSeconds,
            RegionEnd = command.EndSeconds,
            Summary = summary,
            RanAt = DateTimeOffset.UtcNow,
        };

        return Task.FromResult(result);
    }

    private Task<AgentAnalysisResult> RunLevelAnalysis(RunAgentAnalysisCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var fullResult = analysisService.Analyze(command.FilePath);
        var firstChannel = fullResult.Level.Channels.Count > 0 ? fullResult.Level.Channels[0] : null;

        var summary = new Dictionary<string, object?>
        {
            ["channelCount"] = fullResult.Level.Channels.Count,
            ["peak"] = firstChannel?.Peak,
            ["peakDb"] = firstChannel?.PeakDb,
            ["rms"] = firstChannel?.Rms,
            ["rmsDb"] = firstChannel?.RmsDb,
            ["crestFactorDb"] = firstChannel?.CrestFactorDb,
            ["dcOffset"] = firstChannel?.DcOffset,
            ["unit"] = firstChannel?.Unit,
            ["dbUnit"] = firstChannel?.DbUnit,
            ["isCalibrated"] = firstChannel?.IsCalibrated,
        };

        var result = new AgentAnalysisResult
        {
            Kind = "level",
            FileId = command.FilePath,
            RegionStart = command.StartSeconds,
            RegionEnd = command.EndSeconds,
            Summary = summary,
            RanAt = DateTimeOffset.UtcNow,
        };

        return Task.FromResult(result);
    }

    private async Task<AgentAnalysisResult> RunSpectrumAnalysis(RunAgentAnalysisCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var fullAnalysis = analysisService.Analyze(command.FilePath);
        var durationSeconds = fullAnalysis.FileInfo.DurationSeconds;

        var startSeconds = command.StartSeconds ?? 0.0;
        var endSeconds = command.EndSeconds ?? durationSeconds;

        var spectrumQuery = new RunSpectrumQuery(
            FilePath: command.FilePath,
            StartSeconds: startSeconds,
            EndSeconds: endSeconds,
            FftSize: DefaultFftSize,
            Overlap: DefaultOverlap
        );

        var spectrumResult = await spectrumQuery.ExecuteAsync(ct);

        var firstChannel = spectrumResult.Channels.Count > 0 ? spectrumResult.Channels[0] : null;
        var strongestTonalPeak = spectrumResult.Channels
            .SelectMany(channel => channel.TonalPeaks)
            .OrderByDescending(peak => peak.ProminenceDb)
            .ThenByDescending(peak => peak.MagnitudeDb)
            .FirstOrDefault();
        var binCount = firstChannel?.FrequenciesHz.Count ?? 0;

        var summary = new Dictionary<string, object?>
        {
            ["fftSize"] = spectrumResult.Parameters.FftSize,
            ["windowType"] = spectrumResult.Parameters.WindowType,
            ["binCount"] = binCount,
            ["peakFrequencyHz"] = firstChannel?.PeakFrequencyHz,
            ["peakMagnitudeDb"] = firstChannel?.MaxMagnitudeDb,
            ["tonalPeakFrequencyHz"] = strongestTonalPeak?.FrequencyHz,
            ["tonalPeakProminenceDb"] = strongestTonalPeak?.ProminenceDb,
            ["tonalPeakLocalFloorDb"] = strongestTonalPeak?.LocalFloorDb,
            ["tonalPeakConfidence"] = strongestTonalPeak?.Confidence,
            ["channelCount"] = spectrumResult.Channels.Count,
            ["regionStartSeconds"] = startSeconds,
            ["regionEndSeconds"] = endSeconds,
        };

        var result = new AgentAnalysisResult
        {
            Kind = "spectrum",
            FileId = command.FilePath,
            RegionStart = command.StartSeconds,
            RegionEnd = command.EndSeconds,
            Summary = summary,
            RanAt = DateTimeOffset.UtcNow,
        };

        return result;
    }
}
