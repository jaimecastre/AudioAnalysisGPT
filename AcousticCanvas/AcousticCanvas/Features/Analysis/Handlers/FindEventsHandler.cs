using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class FindEventsHandler(SignalAnalysisService analysisService)
    : CommandHandler<FindEventsCommand, FindEventsResult>
{
    public override Task<FindEventsResult> ExecuteAsync(
        FindEventsCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (!File.Exists(command.FilePath))
        {
            throw new FileNotFoundException($"Audio file not found: {command.FilePath}");
        }

        var validKinds = new[] { "clipping", "silence", "loudest", "transient" };
        var kindIsValid = Array.Exists(validKinds, k => k == command.Kind);
        if (!kindIsValid)
        {
            throw new ArgumentException(
                $"Unknown event kind: '{command.Kind}'. Supported: {string.Join(", ", validKinds)}."
            );
        }

        var signalFile = analysisService.ImportFile(command.FilePath);
        var channel = signalFile.Channels.Count > 0 ? signalFile.Channels[0] : null;

        if (channel is null)
        {
            return Task.FromResult(
                new FindEventsResult
                {
                    FileId = command.FilePath,
                    Kind = command.Kind,
                    Events = [],
                    EventCount = 0,
                    RegionStartSeconds = 0.0,
                    RegionEndSeconds = 0.0,
                    RanAt = DateTimeOffset.UtcNow,
                }
            );
        }

        var durationSeconds = channel.SampleCount / (double)channel.SampleRate;
        var startSeconds = command.StartSeconds ?? 0.0;
        var endSeconds = command.EndSeconds ?? durationSeconds;

        startSeconds = Math.Max(0.0, startSeconds);
        endSeconds = Math.Min(durationSeconds, endSeconds);

        var startSample = (int)(startSeconds * channel.SampleRate);
        var endSample = (int)(endSeconds * channel.SampleRate);

        startSample = Math.Clamp(startSample, 0, channel.Samples.Length);
        endSample = Math.Clamp(endSample, startSample, channel.Samples.Length);

        IReadOnlyList<AudioEvent> events = command.Kind switch
        {
            "clipping" => AudioEventFinders.FindClippingEvents(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "silence" => AudioEventFinders.FindSilenceEvents(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "loudest" => AudioEventFinders.FindLoudestRegion(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "transient" => AudioEventFinders.FindTransientEvents(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            _ => [],
        };

        return Task.FromResult(
            new FindEventsResult
            {
                FileId = command.FilePath,
                Kind = command.Kind,
                Events = events,
                EventCount = events.Count,
                RegionStartSeconds = startSeconds,
                RegionEndSeconds = endSeconds,
                RanAt = DateTimeOffset.UtcNow,
            }
        );
    }
}
