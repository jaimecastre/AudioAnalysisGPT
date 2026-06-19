using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunFindingsHandler(SignalAnalysisService analysisService)
    : CommandHandler<RunFindingsCommand, FindingsResult>
{
    private const int FindingsSpectrumFftSize = 44100;
    private const double FindingsSpectrumOverlap = 0.5;

    public override async Task<FindingsResult> ExecuteAsync(
        RunFindingsCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(command.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {command.FilePath}");
        }

        // Load file once - this is the expensive part
        var signalFile = analysisService.ImportFile(command.FilePath);
        var channel = signalFile.Channels.Count > 0 ? signalFile.Channels[0] : null;

        if (channel is null)
        {
            return new FindingsResult
            {
                FileId = command.FilePath,
                Findings = [],
                FindingCount = 0,
                RanAt = DateTimeOffset.UtcNow,
            };
        }

        var durationSeconds = channel.SampleCount / (double)channel.SampleRate;

        // Run level analysis on the loaded data
        var levelAnalysis = LevelAnalyzer.Analyze(signalFile.Channels, 0.0, durationSeconds);

        // Run all 4 event detectors on the same loaded data (no re-import)
        var allSamples = channel.Samples;
        var sampleRate = channel.SampleRate;
        var sampleCount = allSamples.Length;

        var clippingEvents = Task.Run(
            () => AudioEventFinders.FindClippingEvents(allSamples, 0, sampleCount, sampleRate, 0.0),
            ct
        );
        var silenceEvents = Task.Run(
            () => AudioEventFinders.FindSilenceEvents(allSamples, 0, sampleCount, sampleRate, 0.0),
            ct
        );
        var loudestEvents = Task.Run(
            () => AudioEventFinders.FindLoudestRegion(allSamples, 0, sampleCount, sampleRate, 0.0),
            ct
        );
        var transientEvents = Task.Run(
            () =>
                AudioEventFinders.FindTransientEvents(allSamples, 0, sampleCount, sampleRate, 0.0),
            ct
        );

        var allEvents = await Task.WhenAll(
            clippingEvents,
            silenceEvents,
            loudestEvents,
            transientEvents
        );
        var allEventResults = new[]
        {
            new FindEventsResult
            {
                FileId = command.FilePath,
                Kind = "clipping",
                Events = allEvents[0],
                EventCount = allEvents[0].Count,
                RegionStartSeconds = 0.0,
                RegionEndSeconds = durationSeconds,
                RanAt = DateTimeOffset.UtcNow,
            },
            new FindEventsResult
            {
                FileId = command.FilePath,
                Kind = "silence",
                Events = allEvents[1],
                EventCount = allEvents[1].Count,
                RegionStartSeconds = 0.0,
                RegionEndSeconds = durationSeconds,
                RanAt = DateTimeOffset.UtcNow,
            },
            new FindEventsResult
            {
                FileId = command.FilePath,
                Kind = "loudest",
                Events = allEvents[2],
                EventCount = allEvents[2].Count,
                RegionStartSeconds = 0.0,
                RegionEndSeconds = durationSeconds,
                RanAt = DateTimeOffset.UtcNow,
            },
            new FindEventsResult
            {
                FileId = command.FilePath,
                Kind = "transient",
                Events = allEvents[3],
                EventCount = allEvents[3].Count,
                RegionStartSeconds = 0.0,
                RegionEndSeconds = durationSeconds,
                RanAt = DateTimeOffset.UtcNow,
            },
        };

        var spectrumAnalysis = SpectrumAnalyzer.Analyze(
            signalFile.Channels,
            0.0,
            durationSeconds,
            FindingsSpectrumFftSize,
            FindingsSpectrumOverlap
        );

        var findings = FindingsEngine.GenerateFindings(
            command.FilePath,
            levelAnalysis,
            allEventResults,
            spectrumAnalysis
        );

        return new FindingsResult
        {
            FileId = command.FilePath,
            Findings = findings,
            FindingCount = findings.Count,
            RanAt = DateTimeOffset.UtcNow,
        };
    }
}
