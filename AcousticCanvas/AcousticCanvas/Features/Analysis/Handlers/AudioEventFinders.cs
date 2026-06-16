using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Handlers;

public static class AudioEventFinders
{
    private const double ClippingThreshold = 0.99;
    private const int MinClippingSampleCount = 2;
    private const double SilenceThresholdDb = -40.0;
    private const double MinSilenceDurationSeconds = 0.10;
    private const int LoudestRegionWindowMs = 500;

    public static IReadOnlyList<AudioEvent> FindClippingEvents(
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

    public static IReadOnlyList<AudioEvent> FindSilenceEvents(
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

    public static IReadOnlyList<AudioEvent> FindLoudestRegion(
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

        if (windowSamples <= 0 || endSample <= startSample)
        {
            return [];
        }

        // Sliding window optimization: O(n) instead of O(n×m)
        // Compute initial window sum
        var sumSquares = 0.0;
        for (int j = startSample; j < startSample + windowSamples && j < endSample; j++)
        {
            var s = (double)samples[j];
            sumSquares += s * s;
        }

        var bestSumSquares = sumSquares;
        var bestStart = startSample;

        // Slide window: subtract outgoing sample, add incoming sample
        for (int i = startSample + 1; i <= endSample - windowSamples; i++)
        {
            var outgoing = (double)samples[i - 1];
            var incoming = (double)samples[i + windowSamples - 1];
            sumSquares = sumSquares - (outgoing * outgoing) + (incoming * incoming);

            if (sumSquares > bestSumSquares)
            {
                bestSumSquares = sumSquares;
                bestStart = i;
            }
        }

        var bestRms = Math.Sqrt(bestSumSquares / windowSamples);
        var startSec = regionOffsetSeconds + (bestStart - startSample) / (double)sampleRate;
        var endSec =
            regionOffsetSeconds + (bestStart + windowSamples - startSample) / (double)sampleRate;
        var rmsDb = bestRms > 0.0 ? 20.0 * Math.Log10(bestRms) : double.NegativeInfinity;

        return
        [
            MakeEvent(
                "loudest",
                startSec,
                endSec,
                $"Loudest {LoudestRegionWindowMs}ms window: {Math.Round(rmsDb, 2)} dBFS RMS",
                new() { ["rmsDb"] = Math.Round(rmsDb, 4), ["windowMs"] = LoudestRegionWindowMs }
            ),
        ];
    }

    public static IReadOnlyList<AudioEvent> FindTransientEvents(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        double regionOffsetSeconds
    )
    {
        var events = new List<AudioEvent>();
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
