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

        return null;
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
