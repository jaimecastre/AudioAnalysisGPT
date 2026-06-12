using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class FindEventsHandler(SignalAnalysisService analysisService)
    : CommandHandler<FindEventsCommand, FindEventsResult>
{
    // Clipping: 0.99 linear (≈ −0.087 dBFS) matches professional practice (FrequencyDetector, DSP.SE consensus).
    // A single isolated peak at max is a legitimate transient; only a flat-topped plateau of ≥ 2 consecutive
    // saturated samples is definitively digital clipping (AES/Elsevier 2021, Nonlinear Waveform Distortion).
    private const double ClippingThreshold = 0.99;
    private const int MinClippingSampleCount = 2;

    // Silence: −40 dBFS threshold and 100 ms minimum duration per EBU QC specification 0078B (broadcast standard).
    // −60 dBFS is too sensitive for typical recordings and will fire on noise floors.
    private const double SilenceThresholdDb = -40.0;
    private const double MinSilenceDurationSeconds = 0.10;

    private const int LoudestRegionWindowMs = 500;

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
            "clipping" => FindClippingEvents(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "silence" => FindSilenceEvents(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "loudest" => FindLoudestRegion(
                channel.Samples,
                startSample,
                endSample,
                channel.SampleRate,
                startSeconds
            ),
            "transient" => FindTransientEvents(
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

    private static IReadOnlyList<AudioEvent> FindClippingEvents(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        double regionOffsetSeconds
    )
    {
        var events = new List<AudioEvent>();
        var inClip = false;
        var clipStart = 0;

        for (int i = startSample; i <= endSample; i++)
        {
            var aboveThreshold = i < endSample && Math.Abs(samples[i]) >= ClippingThreshold;

            if (aboveThreshold && !inClip)
            {
                inClip = true;
                clipStart = i;
            }
            else if (!aboveThreshold && inClip)
            {
                inClip = false;
                var clippedSampleCount = i - clipStart;
                if (clippedSampleCount >= MinClippingSampleCount)
                {
                    var startSec =
                        regionOffsetSeconds + (clipStart - startSample) / (double)sampleRate;
                    var endSec = regionOffsetSeconds + (i - startSample) / (double)sampleRate;
                    var peakAmplitude = FindPeakAbsolute(samples, clipStart, i);
                    events.Add(
                        MakeEvent(
                            "clipping",
                            startSec,
                            endSec,
                            $"Clipping: {clippedSampleCount} consecutive saturated samples (≥ {ClippingThreshold:F2} FS)",
                            new()
                            {
                                ["sampleCount"] = clippedSampleCount,
                                ["peakAmplitude"] = Math.Round(peakAmplitude, 6),
                                ["thresholdFs"] = ClippingThreshold,
                            }
                        )
                    );
                }
            }
        }

        return events;
    }

    private static IReadOnlyList<AudioEvent> FindSilenceEvents(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        double regionOffsetSeconds
    )
    {
        var events = new List<AudioEvent>();
        var silenceThresholdLinear = Math.Pow(10.0, SilenceThresholdDb / 20.0);
        var minSilenceSamples = (int)(MinSilenceDurationSeconds * sampleRate);
        var inSilence = false;
        var silenceStart = 0;

        for (int i = startSample; i <= endSample; i++)
        {
            var belowThreshold = i < endSample && Math.Abs(samples[i]) <= silenceThresholdLinear;

            if (belowThreshold && !inSilence)
            {
                inSilence = true;
                silenceStart = i;
            }
            else if (!belowThreshold && inSilence)
            {
                inSilence = false;
                var silenceSamples = i - silenceStart;
                if (silenceSamples >= minSilenceSamples)
                {
                    var startSec =
                        regionOffsetSeconds + (silenceStart - startSample) / (double)sampleRate;
                    var endSec = regionOffsetSeconds + (i - startSample) / (double)sampleRate;
                    events.Add(
                        MakeEvent(
                            "silence",
                            startSec,
                            endSec,
                            $"Silence: {Math.Round(endSec - startSec, 3)}s below {SilenceThresholdDb} dBFS (EBU QC 0078B)",
                            new()
                            {
                                ["thresholdDb"] = SilenceThresholdDb,
                                ["sampleCount"] = silenceSamples,
                            }
                        )
                    );
                }
            }
        }

        return events;
    }

    private static IReadOnlyList<AudioEvent> FindLoudestRegion(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        double regionOffsetSeconds
    )
    {
        var windowSamples = (int)((LoudestRegionWindowMs / 1000.0) * sampleRate);
        if (windowSamples <= 0 || endSample - startSample < windowSamples)
        {
            windowSamples = endSample - startSample;
        }

        var bestRms = 0.0;
        var bestStart = startSample;

        for (int i = startSample; i <= endSample - windowSamples; i++)
        {
            var sumSquares = 0.0;
            for (int j = i; j < i + windowSamples; j++)
            {
                sumSquares += (double)samples[j] * samples[j];
            }
            var rms = Math.Sqrt(sumSquares / windowSamples);
            if (rms > bestRms)
            {
                bestRms = rms;
                bestStart = i;
            }
        }

        var startSec = regionOffsetSeconds + (bestStart - startSample) / (double)sampleRate;
        var endSec =
            regionOffsetSeconds + (bestStart + windowSamples - startSample) / (double)sampleRate;
        var rmsDb = AcousticPressureConverter.ComputeDbSpl(bestRms);

        return
        [
            MakeEvent(
                "loudest",
                startSec,
                endSec,
                $"Loudest {LoudestRegionWindowMs}ms window: {Math.Round(rmsDb, 2)} dB re 20 µPa RMS",
                new() { ["rmsDb"] = Math.Round(rmsDb, 4), ["windowMs"] = LoudestRegionWindowMs }
            ),
        ];
    }

    private static IReadOnlyList<AudioEvent> FindTransientEvents(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        double regionOffsetSeconds
    )
    {
        var events = new List<AudioEvent>();
        // Energy-based onset detection following Müller FMP §6.1.1 (energy novelty function).
        // Attack window: 10 ms — short enough to capture percussive transients, long enough to avoid
        // individual-sample noise spikes that a 2 ms window would misfire on.
        // Pre-window: 30 ms — covers one full period of 33 Hz fundamental; avoids false triggers on
        // amplitude modulation within a sustained note.
        // De-bounce: 50 ms — prevents duplicate detections while allowing hits at 120 BPM (500 ms spacing).
        // Threshold: 6 dB ratio (post vs pre RMS) is a widely used starting point for percussive material.
        var attackWindowSamples = Math.Max(1, (int)(0.010 * sampleRate));
        var releaseWindowSamples = Math.Max(1, (int)(0.030 * sampleRate));
        var transientThreshold = 6.0;
        var debounceSamples = (int)(0.050 * sampleRate);

        for (int i = startSample + releaseWindowSamples; i < endSample - attackWindowSamples; i++)
        {
            var attackRms = ComputeRms(samples, i, Math.Min(i + attackWindowSamples, endSample));
            var releaseRms = ComputeRms(
                samples,
                Math.Max(startSample, i - releaseWindowSamples),
                i
            );

            if (releaseRms <= 0.0)
                continue;

            var ratioDb = 20.0 * Math.Log10(attackRms / releaseRms);
            if (ratioDb >= transientThreshold)
            {
                var transientSec = regionOffsetSeconds + (i - startSample) / (double)sampleRate;

                var tooClose =
                    events.Count > 0
                    && transientSec - events[events.Count - 1].StartSeconds
                        < debounceSamples / (double)sampleRate;

                if (!tooClose)
                {
                    var attackEndSec = transientSec + attackWindowSamples / (double)sampleRate;
                    events.Add(
                        MakeEvent(
                            "transient",
                            transientSec,
                            attackEndSec,
                            $"Transient onset: {Math.Round(ratioDb, 1)} dB attack ratio",
                            new()
                            {
                                ["attackRatioDb"] = Math.Round(ratioDb, 2),
                                ["attackRms"] = Math.Round(attackRms, 6),
                                ["preRms"] = Math.Round(releaseRms, 6),
                            }
                        )
                    );
                }
            }
        }

        return events;
    }

    private static AudioEvent MakeEvent(
        string kind,
        double startSec,
        double endSec,
        string description,
        Dictionary<string, object?> metadata
    )
    {
        return new AudioEvent
        {
            Kind = kind,
            StartSeconds = Math.Round(startSec, 6),
            EndSeconds = Math.Round(endSec, 6),
            DurationSeconds = Math.Round(endSec - startSec, 6),
            Description = description,
            Metadata = metadata,
        };
    }

    private static double ComputeRms(float[] samples, int from, int to)
    {
        if (from >= to)
            return 0.0;
        var sumSquares = 0.0;
        for (int i = from; i < to; i++)
        {
            sumSquares += (double)samples[i] * samples[i];
        }
        return Math.Sqrt(sumSquares / (to - from));
    }

    private static double FindPeakAbsolute(float[] samples, int from, int to)
    {
        var peak = 0.0;
        for (int i = from; i < to; i++)
        {
            var abs = Math.Abs(samples[i]);
            if (abs > peak)
                peak = abs;
        }
        return peak;
    }
}
