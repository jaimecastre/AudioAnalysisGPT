using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class FindingsEngine
{
    // Crest factor above this value indicates a highly peaked, impulsive signal.
    // 20 dB is the threshold used in broadcast loudness QC (EBU R128 annex).
    private const double HighCrestFactorThresholdDb = 20.0;

    // DC offset above this linear amplitude is audible and may cause pop artefacts on playback.
    // 0.01 FS ≈ −40 dBFS, consistent with the silence floor used elsewhere in the codebase.
    private const double DcOffsetThresholdLinear = 0.01;

    // Silence gap longer than this is considered a production issue (high severity).
    private const double LongSilenceDurationSeconds = 1.0;

    public static IReadOnlyList<Finding> GenerateFindings(
        string fileId,
        LevelAnalysis levelAnalysis,
        IReadOnlyList<FindEventsResult> eventResults,
        SpectrumAnalysis? spectrumAnalysis = null)
    {
        var findings = new List<Finding>();
        var generatedAt = DateTimeOffset.UtcNow;
        var findingIndex = 0;

        string NextFindingId()
        {
            findingIndex++;
            return $"finding_{fileId}_{findingIndex:D3}";
        }

        var firstChannel = levelAnalysis.Channels.Count > 0 ? levelAnalysis.Channels[0] : null;

        AddClippingFindings(fileId, eventResults, findings, generatedAt, NextFindingId);
        AddSilenceFindings(fileId, eventResults, findings, generatedAt, NextFindingId);
        AddHighCrestFactorFinding(fileId, firstChannel, findings, generatedAt, NextFindingId);
        AddDcOffsetFinding(fileId, firstChannel, findings, generatedAt, NextFindingId);
        AddTonalPeakFinding(fileId, spectrumAnalysis, findings, generatedAt, NextFindingId);

        return findings;
    }

    private static void AddClippingFindings(
        string fileId,
        IReadOnlyList<FindEventsResult> eventResults,
        List<Finding> findings,
        DateTimeOffset generatedAt,
        Func<string> nextId)
    {
        var clippingResult = FindResultByKind(eventResults, "clipping");
        if (clippingResult is null || clippingResult.EventCount == 0)
        {
            return;
        }

        foreach (var clippingEvent in clippingResult.Events)
        {
            var sampleCount = clippingEvent.Metadata.TryGetValue("sampleCount", out var rawCount) ? rawCount : null;
            var peakAmplitude = clippingEvent.Metadata.TryGetValue("peakAmplitude", out var rawPeak) ? rawPeak : null;

            findings.Add(new Finding
            {
                FindingId = nextId(),
                FileId = fileId,
                Type = "clipping",
                Severity = "high",
                Confidence = "observed",
                Title = "Digital Clipping Detected",
                Description = $"Clipping found at {clippingEvent.StartSeconds:F3}s–{clippingEvent.EndSeconds:F3}s ({clippingEvent.DurationSeconds * 1000:F1}ms). " +
                              "Consecutive samples at or above 0.99 FS indicate hard limiting or gain staging issues.",
                Evidence = new Dictionary<string, object?>
                {
                    ["startSeconds"] = clippingEvent.StartSeconds,
                    ["endSeconds"] = clippingEvent.EndSeconds,
                    ["durationMs"] = Math.Round(clippingEvent.DurationSeconds * 1000, 2),
                    ["sampleCount"] = sampleCount,
                    ["peakAmplitude"] = peakAmplitude,
                    ["thresholdFs"] = 0.99,
                },
                StartSeconds = clippingEvent.StartSeconds,
                EndSeconds = clippingEvent.EndSeconds,
                FrequencyHz = null,
                SuggestedNextStep = "Reduce the gain at the source or apply a limiter before the clipping point. " +
                                    "Check upstream gain staging for the affected region.",
                GeneratedAt = generatedAt,
            });
        }
    }

    private static void AddSilenceFindings(
        string fileId,
        IReadOnlyList<FindEventsResult> eventResults,
        List<Finding> findings,
        DateTimeOffset generatedAt,
        Func<string> nextId)
    {
        var silenceResult = FindResultByKind(eventResults, "silence");
        if (silenceResult is null || silenceResult.EventCount == 0)
        {
            return;
        }

        foreach (var silenceEvent in silenceResult.Events)
        {
            var isLong = silenceEvent.DurationSeconds >= LongSilenceDurationSeconds;
            var severity = isLong ? "high" : "medium";

            findings.Add(new Finding
            {
                FindingId = nextId(),
                FileId = fileId,
                Type = "silence_gap",
                Severity = severity,
                Confidence = "observed",
                Title = isLong ? "Extended Silence Gap" : "Silence Gap",
                Description = $"Silence of {silenceEvent.DurationSeconds:F2}s detected at {silenceEvent.StartSeconds:F3}s–{silenceEvent.EndSeconds:F3}s " +
                              "(below −40 dBFS, per EBU QC 0078B). " +
                              (isLong ? "Duration exceeds 1 second — likely an unintended gap." : "May be intentional or a short pause."),
                Evidence = new Dictionary<string, object?>
                {
                    ["startSeconds"] = silenceEvent.StartSeconds,
                    ["endSeconds"] = silenceEvent.EndSeconds,
                    ["durationSeconds"] = Math.Round(silenceEvent.DurationSeconds, 4),
                    ["thresholdDb"] = -40.0,
                    ["standard"] = "EBU QC 0078B",
                },
                StartSeconds = silenceEvent.StartSeconds,
                EndSeconds = silenceEvent.EndSeconds,
                FrequencyHz = null,
                SuggestedNextStep = isLong
                    ? "Verify whether this silence is intentional. If not, check for a missing section or edit point."
                    : "Check whether this silence is intentional or indicates a gap in the recording.",
                GeneratedAt = generatedAt,
            });
        }
    }

    private static void AddHighCrestFactorFinding(
        string fileId,
        ChannelLevelAnalysis? channel,
        List<Finding> findings,
        DateTimeOffset generatedAt,
        Func<string> nextId)
    {
        if (channel?.CrestFactorDb is null)
        {
            return;
        }

        var crestFactorDb = channel.CrestFactorDb.Value;
        if (crestFactorDb <= HighCrestFactorThresholdDb)
        {
            return;
        }

        findings.Add(new Finding
        {
            FindingId = nextId(),
            FileId = fileId,
            Type = "high_crest_factor",
            Severity = "medium",
            Confidence = "inferred",
            Title = "High Crest Factor",
            Description = $"Crest factor of {crestFactorDb:F1} dB exceeds the {HighCrestFactorThresholdDb} dB threshold. " +
                          "This indicates a highly impulsive or transient-heavy signal relative to its RMS level. " +
                          "May indicate sparse transients, a quiet recording with loud peaks, or poor gain staging.",
            Evidence = new Dictionary<string, object?>
            {
                ["crestFactorDb"] = Math.Round(crestFactorDb, 2),
                ["peakDb"] = channel.PeakDb.HasValue ? Math.Round(channel.PeakDb.Value, 2) : null,
                ["rmsDb"] = channel.RmsDb.HasValue ? Math.Round(channel.RmsDb.Value, 2) : null,
                ["thresholdDb"] = HighCrestFactorThresholdDb,
            },
            StartSeconds = null,
            EndSeconds = null,
            FrequencyHz = null,
            SuggestedNextStep = "Inspect the waveform for large transient spikes. Consider normalising or limiting peaks, " +
                                "or applying compression to reduce the peak-to-RMS ratio.",
            GeneratedAt = generatedAt,
        });
    }

    private static void AddDcOffsetFinding(
        string fileId,
        ChannelLevelAnalysis? channel,
        List<Finding> findings,
        DateTimeOffset generatedAt,
        Func<string> nextId)
    {
        if (channel is null)
        {
            return;
        }

        var dcOffsetAbsolute = Math.Abs(channel.DcOffset);
        if (dcOffsetAbsolute <= DcOffsetThresholdLinear)
        {
            return;
        }

        findings.Add(new Finding
        {
            FindingId = nextId(),
            FileId = fileId,
            Type = "dc_offset",
            Severity = "low",
            Confidence = "observed",
            Title = "DC Offset Present",
            Description = $"DC offset of {channel.DcOffset:+0.0000;-0.0000} FS ({dcOffsetAbsolute / 1.0 * 100:F2}% of full scale) detected. " +
                          "DC offset can cause audible thumps on playback, reduce headroom, and degrade downstream processing.",
            Evidence = new Dictionary<string, object?>
            {
                ["dcOffset"] = Math.Round(channel.DcOffset, 6),
                ["dcOffsetAbsolute"] = Math.Round(dcOffsetAbsolute, 6),
                ["thresholdLinear"] = DcOffsetThresholdLinear,
            },
            StartSeconds = null,
            EndSeconds = null,
            FrequencyHz = null,
            SuggestedNextStep = "Apply a DC offset removal filter (high-pass at a very low frequency, e.g. 5–10 Hz) " +
                                "to eliminate the offset before further processing.",
            GeneratedAt = generatedAt,
        });
    }

    private static void AddTonalPeakFinding(
        string fileId,
        SpectrumAnalysis? spectrumAnalysis,
        List<Finding> findings,
        DateTimeOffset generatedAt,
        Func<string> nextId)
    {
        if (spectrumAnalysis is null)
        {
            return;
        }

        var tonalPeak = spectrumAnalysis.Channels
            .SelectMany(channel => channel.TonalPeaks.Select(peak => new { Channel = channel, Peak = peak }))
            .OrderByDescending(item => item.Peak.ProminenceDb)
            .ThenByDescending(item => item.Peak.MagnitudeDb)
            .FirstOrDefault();

        if (tonalPeak is null)
        {
            return;
        }

        var severity = tonalPeak.Peak.ProminenceDb >= 15.0 ? "medium" : "low";

        findings.Add(new Finding
        {
            FindingId = nextId(),
            FileId = fileId,
            Type = "tonal_peak",
            Severity = severity,
            Confidence = "inferred",
            Title = "Prominent Tonal Peak",
            Description = $"A narrow spectral peak at {tonalPeak.Peak.FrequencyHz:F1} Hz stands {tonalPeak.Peak.ProminenceDb:F1} dB above its local spectral floor. " +
                          "This can indicate a tonal component such as whine, hum, resonance, or another steady narrow-band source.",
            Evidence = new Dictionary<string, object?>
            {
                ["channelId"] = tonalPeak.Channel.ChannelId,
                ["channelName"] = tonalPeak.Channel.ChannelName,
                ["frequencyHz"] = tonalPeak.Peak.FrequencyHz,
                ["magnitudeDb"] = tonalPeak.Peak.MagnitudeDb,
                ["localFloorDb"] = tonalPeak.Peak.LocalFloorDb,
                ["prominenceDb"] = tonalPeak.Peak.ProminenceDb,
                ["bandwidthHz"] = tonalPeak.Peak.BandwidthHz,
                ["confidence"] = tonalPeak.Peak.Confidence,
                ["method"] = tonalPeak.Peak.Method,
            },
            StartSeconds = spectrumAnalysis.Region.StartSeconds,
            EndSeconds = spectrumAnalysis.Region.EndSeconds,
            FrequencyHz = tonalPeak.Peak.FrequencyHz,
            SuggestedNextStep = "Inspect the spectrum around this frequency and compare it against a reference recording, RPM/order data, or operating-state metadata.",
            GeneratedAt = generatedAt,
        });
    }

    private static FindEventsResult? FindResultByKind(IReadOnlyList<FindEventsResult> eventResults, string kind)
    {
        foreach (var result in eventResults)
        {
            if (result.Kind == kind)
            {
                return result;
            }
        }
        return null;
    }
}
