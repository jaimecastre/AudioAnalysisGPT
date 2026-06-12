using System.Text.RegularExpressions;

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

        if (ContainsAnyPhrase(normalized, InterpretivePhrases))
        {
            return null;
        }

        if (ContainsAnyPhrase(normalized, ComparisonPhrases))
        {
            return null;
        }

        if (ContainsAnyPhrase(normalized, SpectralPhrases))
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
                ToolName = "run_basic_metrics",
                RequestedFields = basicMetricFields,
            };
        }

        if (asksForMetadata)
        {
            return new DeterministicFactPlan
            {
                ToolName = "get_metadata",
                RequestedFields = metadataFields,
            };
        }

        return null;
    }

    private static List<string> DetectBasicMetricFields(string normalized)
    {
        var fields = new List<string>();

        if (ContainsWord(normalized, "peak"))
        {
            fields.Add("peak");
        }

        if (ContainsWord(normalized, "rms"))
        {
            fields.Add("rms");
        }

        if (ContainsWord(normalized, "crest"))
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
        var wantsFullSummary = ContainsAnyPhrase(normalized, FullMetadataPhrases);
        if (wantsFullSummary)
        {
            return ["fileName", "duration", "sampleRate", "channels", "bitDepth"];
        }

        var fields = new List<string>();

        if (ContainsWord(normalized, "filename") || normalized.Contains("file name"))
        {
            fields.Add("fileName");
        }

        if (
            ContainsWord(normalized, "duration")
            || ContainsWord(normalized, "length")
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
            ContainsWord(normalized, "channel")
            || ContainsWord(normalized, "channels")
            || ContainsWord(normalized, "mono")
            || ContainsWord(normalized, "stereo")
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

    private static bool ContainsAnyPhrase(string text, string[] phrases)
    {
        foreach (var phrase in phrases)
        {
            if (text.Contains(phrase))
            {
                return true;
            }
        }
        return false;
    }

    private static bool ContainsWord(string text, string word)
    {
        var pattern = $"\\b{Regex.Escape(word)}\\b";
        return Regex.IsMatch(text, pattern);
    }
}
