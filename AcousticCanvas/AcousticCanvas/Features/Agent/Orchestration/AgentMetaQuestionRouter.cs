namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentMetaQuestionRouter
{
    private static readonly string[] WhyBothPhrases =
    [
        "why did you analyse both",
        "why did you analyze both",
        "why did you analyse all",
        "why did you analyze all",
        "why are you analysing both",
        "why are you analyzing both",
        "why are you analysing all",
        "why are you analyzing all",
        "why did it analyse both",
        "why did it analyze both",
    ];

    private static readonly string[] WorkspaceInstructionPhrases =
    [
        "click spectrogram evidence pill",
        "click the spectrogram evidence pill",
        "click evidence pill",
        "click the evidence pill",
        "inspect workspace card",
        "inspect the workspace card",
        "open workspace card",
        "open the workspace card",
    ];

    public static string? TryAnswer(string userQuestion)
    {
        var normalized = userQuestion.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            return null;
        }

        if (ContainsAnyPhrase(normalized, WhyBothPhrases))
        {
            return "I analyzed both because the Agent request was given multiple files in the selected file list. When you want only one file, mention it explicitly with @filename; the Agent will then target only that file.";
        }

        if (ContainsAnyPhrase(normalized, WorkspaceInstructionPhrases))
        {
            return "That is a UI action, not an audio-analysis request. Click the Spectrogram evidence pill in the chat to focus the matching Spectrogram card in the right workspace, then inspect the card there.";
        }

        if (IsSpectrogramSplQuestion(normalized))
        {
            return "The Agent spectrogram does not report SPL. It is a byte-normalized visualization of relative time-frequency energy, not a calibrated acoustic level measurement. To report SPL, the recording chain would need calibration metadata and a calibrated level analysis.";
        }

        if (IsSpectrumSplQuestion(normalized))
        {
            return "The Agent spectrum is reported in digital dBFS unless the recording has calibration metadata. It cannot report SPL from an uncalibrated audio file. To report SPL, the recording chain needs calibration to a physical pressure reference such as 20 uPa.";
        }

        if (IsCpbSplQuestion(normalized))
        {
            return "The Agent CPB result is reported in digital dBFS unless the recording has calibration metadata. It cannot report SPL or standards-compliant octave-band levels from an uncalibrated audio file.";
        }

        if (IsSoundQualityConversionQuestion(normalized))
        {
            return "Sound-quality metrics such as loudness in sone, sharpness in acum, and roughness in asper cannot be converted directly to LUFS, SPL, or a gain change. They describe psychoacoustic perception, not calibrated electrical or acoustic level.";
        }

        if (IsSpectrogramDefinitionQuestion(normalized))
        {
            return "A spectrogram is a time-frequency view of audio. The horizontal axis represents time, the vertical axis represents frequency, and color or intensity represents the relative energy at each time and frequency. It is useful for seeing how tones, noise, bursts, and frequency content change over time.";
        }

        if (IsSpectrumDefinitionQuestion(normalized))
        {
            return "An FFT spectrum shows how audio energy is distributed across frequency for the analyzed signal or region. It is useful for identifying dominant frequencies, tonal peaks, low-frequency buildup, and broadband balance, but it does not by itself explain the physical cause of a peak.";
        }

        if (IsCpbDefinitionQuestion(normalized))
        {
            return "CPB means constant-percentage-band analysis. It groups frequency energy into octave or fractional-octave bands, which is useful for reading broad low, mid, and high-frequency balance more clearly than a dense FFT spectrum.";
        }

        if (IsSoundQualityDefinitionQuestion(normalized))
        {
            return "Sound-quality metrics are psychoacoustic metrics that describe perceived qualities of a sound. In this app, loudness is reported in sone, sharpness in acum, and roughness in asper using MoSQITo. They are useful for comparing perception between files, but they are not replacements for calibrated SPL, LUFS, or causal diagnosis.";
        }

        return null;
    }

    private static bool IsSpectrogramSplQuestion(string text)
    {
        return text.Contains("spectrogram", StringComparison.Ordinal)
            && (
                text.Contains("spl", StringComparison.Ordinal)
                || text.Contains("sound pressure", StringComparison.Ordinal)
                || text.Contains("calibrated level", StringComparison.Ordinal)
            );
    }

    private static bool IsSpectrumSplQuestion(string text)
    {
        return (
                text.Contains("spectrum", StringComparison.Ordinal)
                || text.Contains("spectral", StringComparison.Ordinal)
                || text.Contains("peak", StringComparison.Ordinal)
            )
            && (
                text.Contains("spl", StringComparison.Ordinal)
                || text.Contains("sound pressure", StringComparison.Ordinal)
                || text.Contains("calibrated level", StringComparison.Ordinal)
            );
    }

    private static bool IsCpbSplQuestion(string text)
    {
        return (
                text.Contains("cpb", StringComparison.Ordinal)
                || text.Contains("octave", StringComparison.Ordinal)
                || text.Contains("1/3", StringComparison.Ordinal)
                || text.Contains("third octave", StringComparison.Ordinal)
            )
            && (
                text.Contains("spl", StringComparison.Ordinal)
                || text.Contains("sound pressure", StringComparison.Ordinal)
                || text.Contains("calibrated level", StringComparison.Ordinal)
                || text.Contains("standard", StringComparison.Ordinal)
                || text.Contains("compliance", StringComparison.Ordinal)
            );
    }

    private static bool IsSoundQualityConversionQuestion(string text)
    {
        var mentionsSoundQualityMetric =
            text.Contains("sone", StringComparison.Ordinal)
            || text.Contains("loudness", StringComparison.Ordinal)
            || text.Contains("sharpness", StringComparison.Ordinal)
            || text.Contains("roughness", StringComparison.Ordinal)
            || text.Contains("acum", StringComparison.Ordinal)
            || text.Contains("asper", StringComparison.Ordinal);

        var asksUnsupportedScale =
            text.Contains("lufs", StringComparison.Ordinal)
            || text.Contains("spl", StringComparison.Ordinal)
            || text.Contains("db gain", StringComparison.Ordinal)
            || text.Contains("gain change", StringComparison.Ordinal)
            || text.Contains("convert", StringComparison.Ordinal);

        return mentionsSoundQualityMetric && asksUnsupportedScale;
    }

    private static bool IsSpectrogramDefinitionQuestion(string text)
    {
        var asksDefinition =
            text.StartsWith("what is ", StringComparison.Ordinal)
            || text.StartsWith("what's ", StringComparison.Ordinal)
            || text.StartsWith("explain ", StringComparison.Ordinal)
            || text.StartsWith("define ", StringComparison.Ordinal)
            || text.StartsWith("what does ", StringComparison.Ordinal);

        return asksDefinition
            && text.Contains("spectrogram", StringComparison.Ordinal)
            && !text.Contains("show", StringComparison.Ordinal)
            && !text.Contains("spl", StringComparison.Ordinal)
            && !text.Contains("db", StringComparison.Ordinal)
            && !text.Contains("value", StringComparison.Ordinal)
            && !text.Contains("energy", StringComparison.Ordinal)
            && !text.Contains("cause", StringComparison.Ordinal)
            && !text.Contains("band", StringComparison.Ordinal)
            && !text.Contains("near", StringComparison.Ordinal)
            && !text.Contains("throughout", StringComparison.Ordinal)
            && !text.Contains("file", StringComparison.Ordinal)
            && !text.Contains("@", StringComparison.Ordinal);
    }

    private static bool IsSpectrumDefinitionQuestion(string text)
    {
        var asksDefinition =
            text.StartsWith("what is ", StringComparison.Ordinal)
            || text.StartsWith("what's ", StringComparison.Ordinal)
            || text.StartsWith("explain ", StringComparison.Ordinal)
            || text.StartsWith("define ", StringComparison.Ordinal)
            || text.StartsWith("what does ", StringComparison.Ordinal);

        return asksDefinition
            && (
                text.Contains("fft spectrum", StringComparison.Ordinal)
                || text.Contains("frequency spectrum", StringComparison.Ordinal)
                || text == "explain fft"
                || text == "define fft"
            )
            && !text.Contains("show", StringComparison.Ordinal)
            && !text.Contains("spl", StringComparison.Ordinal)
            && !text.Contains("db", StringComparison.Ordinal)
            && !text.Contains("value", StringComparison.Ordinal)
            && !text.Contains("cause", StringComparison.Ordinal)
            && !text.Contains("peak", StringComparison.Ordinal)
            && !text.Contains("file", StringComparison.Ordinal)
            && !text.Contains("@", StringComparison.Ordinal);
    }

    private static bool IsCpbDefinitionQuestion(string text)
    {
        var asksDefinition =
            text.StartsWith("what is ", StringComparison.Ordinal)
            || text.StartsWith("what's ", StringComparison.Ordinal)
            || text.StartsWith("explain ", StringComparison.Ordinal)
            || text.StartsWith("define ", StringComparison.Ordinal)
            || text.StartsWith("what does ", StringComparison.Ordinal);

        return asksDefinition
            && (
                text.Contains("cpb", StringComparison.Ordinal)
                || text.Contains("octave band", StringComparison.Ordinal)
                || text.Contains("third octave", StringComparison.Ordinal)
                || text.Contains("1/3 octave", StringComparison.Ordinal)
            )
            && !text.Contains("show", StringComparison.Ordinal)
            && !text.Contains("run", StringComparison.Ordinal)
            && !text.Contains("spl", StringComparison.Ordinal)
            && !text.Contains("db", StringComparison.Ordinal)
            && !text.Contains("value", StringComparison.Ordinal)
            && !text.Contains("file", StringComparison.Ordinal)
            && !text.Contains("@", StringComparison.Ordinal);
    }

    private static bool IsSoundQualityDefinitionQuestion(string text)
    {
        var asksDefinition =
            text.StartsWith("what is ", StringComparison.Ordinal)
            || text.StartsWith("what's ", StringComparison.Ordinal)
            || text.StartsWith("explain ", StringComparison.Ordinal)
            || text.StartsWith("define ", StringComparison.Ordinal)
            || text.StartsWith("what does ", StringComparison.Ordinal)
            || text.StartsWith("how is ", StringComparison.Ordinal);

        var asksForMeasuredMetric =
            text.StartsWith("what is the ", StringComparison.Ordinal)
            || text.StartsWith("what's the ", StringComparison.Ordinal)
            || text.Contains("loudness and", StringComparison.Ordinal)
            || text.Contains("sharpness and", StringComparison.Ordinal)
            || text.Contains("roughness and", StringComparison.Ordinal)
            || text.Contains("and loudness", StringComparison.Ordinal)
            || text.Contains("and sharpness", StringComparison.Ordinal)
            || text.Contains("and roughness", StringComparison.Ordinal);

        return asksDefinition
            && (
                text.Contains("sound quality", StringComparison.Ordinal)
                || text.Contains("psychoacoustic", StringComparison.Ordinal)
                || text.Contains("loudness", StringComparison.Ordinal)
                || text.Contains("sharpness", StringComparison.Ordinal)
                || text.Contains("roughness", StringComparison.Ordinal)
                || text.Contains("sone", StringComparison.Ordinal)
                || text.Contains("acum", StringComparison.Ordinal)
                || text.Contains("asper", StringComparison.Ordinal)
            )
            && !text.Contains("file", StringComparison.Ordinal)
            && !text.Contains("@", StringComparison.Ordinal)
            && !text.Contains("value", StringComparison.Ordinal)
            && !text.Contains("measure", StringComparison.Ordinal)
            && !text.Contains("compare", StringComparison.Ordinal)
            && !asksForMeasuredMetric;
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
}
