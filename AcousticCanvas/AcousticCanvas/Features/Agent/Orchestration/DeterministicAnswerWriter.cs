using System.Globalization;

namespace AcousticCanvas.Features.Agent.Orchestration;

// Turns a deterministic-fact plan plus the measured evidence into a plain answer.
// No LLM is involved: the numbers come straight from the backend DSP tools, so the
// answer is always "high" confidence. This is what lets factual questions work even
// when no OpenAI key is configured.
public static class DeterministicAnswerWriter
{
    public static FinalAnswerResponse Write(
        DeterministicFactPlan plan,
        EvidencePackage evidencePackage
    )
    {
        var evidenceType =
            plan.ToolName == AgentToolNames.RunBasicMetrics
                ? EvidenceTypes.BasicMetrics
                : EvidenceTypes.Metadata;

        var matchingItems = new List<EvidenceItem>();
        foreach (var evidenceItem in evidencePackage.KeyEvidence)
        {
            if (evidenceItem.Type == evidenceType)
            {
                matchingItems.Add(evidenceItem);
            }
        }

        if (matchingItems.Count == 0)
        {
            return new FinalAnswerResponse
            {
                Answer = "I couldn't read that measurement for the selected file.",
                EvidenceReferences = [],
                Confidence = "low",
                Limitations =
                [
                    "The requested measurement could not be computed for the selected file.",
                ],
                SuggestedNextSteps = [],
            };
        }

        var answerLines = new List<string>();
        var evidenceReferences = new List<string>();
        var includeFileLabel = matchingItems.Count > 1;

        foreach (var evidenceItem in matchingItems)
        {
            var sentence = BuildSentenceForItem(
                plan.RequestedFields,
                evidenceItem,
                includeFileLabel
            );
            if (!string.IsNullOrWhiteSpace(sentence))
            {
                answerLines.Add(sentence);
                evidenceReferences.Add(evidenceItem.EvidenceId);
            }
        }

        if (answerLines.Count == 0)
        {
            return new FinalAnswerResponse
            {
                Answer = "I couldn't read that measurement for the selected file.",
                EvidenceReferences = [],
                Confidence = "low",
                Limitations =
                [
                    "The requested measurement could not be computed for the selected file.",
                ],
                SuggestedNextSteps = [],
            };
        }

        return new FinalAnswerResponse
        {
            Answer = string.Join("\n", answerLines),
            EvidenceReferences = evidenceReferences,
            Confidence = "high",
            Limitations = [],
            SuggestedNextSteps = [],
        };
    }

    private static string BuildSentenceForItem(
        IReadOnlyList<string> requestedFields,
        EvidenceItem evidenceItem,
        bool includeFileLabel
    )
    {
        var phrases = new List<string>();

        foreach (var field in requestedFields)
        {
            var phrase = BuildPhraseForField(field, evidenceItem.Data);
            if (!string.IsNullOrWhiteSpace(phrase))
            {
                phrases.Add(phrase);
            }
        }

        if (phrases.Count == 0)
        {
            return string.Empty;
        }

        var body = string.Join(" ", phrases);

        if (!includeFileLabel)
        {
            return body;
        }

        var fileLabel =
            ReadString(evidenceItem.Data, "fileName")
            ?? ReadString(evidenceItem.Data, "fileId")
            ?? "File";

        return $"{fileLabel}: {body}";
    }

    private static string? BuildPhraseForField(string field, Dictionary<string, object?> data)
    {
        switch (field)
        {
            case "peak":
                return FormatDb(data, "peakDbFs", "Peak level");
            case "rms":
                return FormatDb(data, "rmsDbFs", "RMS level");
            case "crest":
                return FormatCrest(data);
            case "dcOffset":
                return FormatDcOffset(data);
            case "fileName":
                return FormatFileName(data);
            case "duration":
                return FormatDuration(data);
            case "sampleRate":
                return FormatSampleRate(data);
            case "channels":
                return FormatChannels(data);
            case "bitDepth":
                return FormatBitDepth(data);
            default:
                return null;
        }
    }

    private static string? FormatDb(Dictionary<string, object?> data, string key, string label)
    {
        var value = ReadDouble(data, key);
        if (value is null)
        {
            return null;
        }
        return $"{label}: {value.Value.ToString("0.00", CultureInfo.InvariantCulture)} dB SPL.";
    }

    private static string? FormatCrest(Dictionary<string, object?> data)
    {
        var value = ReadDouble(data, "crestFactorDb");
        if (value is null)
        {
            return null;
        }
        return $"Crest factor: {value.Value.ToString("0.00", CultureInfo.InvariantCulture)} dB.";
    }

    private static string? FormatDcOffset(Dictionary<string, object?> data)
    {
        var value = ReadDouble(data, "dcOffsetLinear");
        if (value is null)
        {
            return null;
        }
        return $"DC offset: {value.Value.ToString("0.000", CultureInfo.InvariantCulture)} (linear).";
    }

    private static string? FormatFileName(Dictionary<string, object?> data)
    {
        var value = ReadString(data, "fileName");
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        return $"File: {value}.";
    }

    private static string? FormatDuration(Dictionary<string, object?> data)
    {
        var value = ReadDouble(data, "durationSeconds");
        if (value is null)
        {
            return null;
        }
        return $"Duration: {value.Value.ToString("0.00", CultureInfo.InvariantCulture)} s.";
    }

    private static string? FormatSampleRate(Dictionary<string, object?> data)
    {
        var value = ReadInt(data, "sampleRateHz");
        if (value is null)
        {
            return null;
        }
        return $"Sample rate: {value.Value.ToString(CultureInfo.InvariantCulture)} Hz.";
    }

    private static string? FormatChannels(Dictionary<string, object?> data)
    {
        var value = ReadInt(data, "channels");
        if (value is null)
        {
            return null;
        }
        return $"Channels: {value.Value.ToString(CultureInfo.InvariantCulture)}.";
    }

    private static string? FormatBitDepth(Dictionary<string, object?> data)
    {
        var value = ReadInt(data, "bitDepth");
        if (value is null)
        {
            return null;
        }
        return $"Bit depth: {value.Value.ToString(CultureInfo.InvariantCulture)}-bit.";
    }

    private static double? ReadDouble(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var rawValue) || rawValue is null)
        {
            return null;
        }
        return Convert.ToDouble(rawValue, CultureInfo.InvariantCulture);
    }

    private static int? ReadInt(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var rawValue) || rawValue is null)
        {
            return null;
        }
        return Convert.ToInt32(rawValue, CultureInfo.InvariantCulture);
    }

    private static string? ReadString(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var rawValue) || rawValue is null)
        {
            return null;
        }
        return rawValue.ToString();
    }
}
