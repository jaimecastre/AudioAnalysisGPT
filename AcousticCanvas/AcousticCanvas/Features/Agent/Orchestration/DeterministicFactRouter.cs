namespace AcousticCanvas.Features.Agent.Orchestration;

// A deterministic-fact plan tells the orchestrator which backend tool to run and
// which exact facts the user asked for, so the answer can be produced without the LLM.
public sealed record DeterministicFactPlan
{
    public required string ToolName { get; init; }
    public required IReadOnlyList<string> RequestedFields { get; init; }
}

// Maps plain factual questions ("what is the peak level?", "what's the sample rate?")
// to a single backend tool. Questions that need interpretation, comparison, or
// spectral reasoning return null so the LLM orchestration path handles them instead.
public static class DeterministicFactRouter
{
    private static readonly string[] InterpretivePhrases =
    [
        "why",
        "too loud",
        "loud enough",
        "should i",
        "is it good",
        "is it bad",
        "sound",
        "muddy",
        "harsh",
        "boomy",
        "boxy",
        "sibilan",
        "dull",
        "thin",
        "piercing",
        "congested",
    ];

    private static readonly string[] ComparisonPhrases =
    [
        "compare",
        "comparison",
        " vs ",
        "versus",
        "difference",
        "different between",
    ];

    private static readonly string[] SpectralPhrases = ["frequency", "spectrum", "spectral", "fft"];

    private static readonly string[] FullMetadataPhrases =
    [
        "file format",
        "format",
        "file info",
        "file information",
        "file details",
        "metadata",
    ];

    public static DeterministicFactPlan? TryRoute(string userQuestion)
    {
        var normalized = userQuestion.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            return null;
        }

        if (PhraseMatcher.ContainsAnySubstring(normalized, InterpretivePhrases))
        {
            return null;
        }

        if (PhraseMatcher.ContainsAnySubstring(normalized, ComparisonPhrases))
        {
            return null;
        }

        if (PhraseMatcher.ContainsAnySubstring(normalized, SpectralPhrases))
        {
            return null;
        }

        var basicMetricFields = DetectBasicMetricFields(normalized);
        var metadataFields = DetectMetadataFields(normalized);

        var asksForBasicMetrics = basicMetricFields.Count > 0;
        var asksForMetadata = metadataFields.Count > 0;

        if (asksForBasicMetrics && asksForMetadata)
        {
            return null;
        }

        if (asksForBasicMetrics)
        {
            return new DeterministicFactPlan
            {
                ToolName = AgentToolNames.RunBasicMetrics,
                RequestedFields = basicMetricFields,
            };
        }

        if (asksForMetadata)
        {
            return new DeterministicFactPlan
            {
                ToolName = AgentToolNames.GetMetadata,
                RequestedFields = metadataFields,
            };
        }

        return null;
    }

    private static List<string> DetectBasicMetricFields(string normalized)
    {
        var fields = new List<string>();

        if (PhraseMatcher.ContainsWord(normalized, "peak"))
        {
            fields.Add("peak");
        }

        if (PhraseMatcher.ContainsWord(normalized, "rms"))
        {
            fields.Add("rms");
        }

        if (PhraseMatcher.ContainsWord(normalized, "crest"))
        {
            fields.Add("crest");
        }

        if (normalized.Contains("dc offset") || normalized.Contains("dc-offset"))
        {
            fields.Add("dcOffset");
        }

        return fields;
    }

    private static List<string> DetectMetadataFields(string normalized)
    {
        var wantsFullSummary = PhraseMatcher.ContainsAnySubstring(normalized, FullMetadataPhrases);
        if (wantsFullSummary)
        {
            return ["fileName", "duration", "sampleRate", "channels", "bitDepth"];
        }

        var fields = new List<string>();

        if (PhraseMatcher.ContainsWord(normalized, "filename") || normalized.Contains("file name"))
        {
            fields.Add("fileName");
        }

        if (
            PhraseMatcher.ContainsWord(normalized, "duration")
            || PhraseMatcher.ContainsWord(normalized, "length")
            || normalized.Contains("how long")
        )
        {
            fields.Add("duration");
        }

        if (
            normalized.Contains("sample rate")
            || normalized.Contains("sampling rate")
            || normalized.Contains("samplerate")
        )
        {
            fields.Add("sampleRate");
        }

        if (
            PhraseMatcher.ContainsWord(normalized, "channel")
            || PhraseMatcher.ContainsWord(normalized, "channels")
            || PhraseMatcher.ContainsWord(normalized, "mono")
            || PhraseMatcher.ContainsWord(normalized, "stereo")
        )
        {
            fields.Add("channels");
        }

        if (
            normalized.Contains("bit depth")
            || normalized.Contains("bit-depth")
            || normalized.Contains("bitdepth")
        )
        {
            fields.Add("bitDepth");
        }

        return fields;
    }
}
