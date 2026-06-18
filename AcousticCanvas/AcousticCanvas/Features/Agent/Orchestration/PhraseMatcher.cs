using System.Text.RegularExpressions;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class PhraseMatcher
{
    public static bool ContainsAnySubstring(string text, IReadOnlyList<string> phrases)
    {
        foreach (var phrase in phrases)
        {
            if (text.Contains(phrase, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    public static bool ContainsAnyWordOrPhrase(string text, IReadOnlyList<string> phrases)
    {
        foreach (var phrase in phrases)
        {
            if (ContainsWordOrPhrase(text, phrase))
            {
                return true;
            }
        }

        return false;
    }

    public static bool ContainsWord(string text, string word)
    {
        var pattern = $"\\b{Regex.Escape(word)}\\b";
        return Regex.IsMatch(text, pattern);
    }

    public static bool ContainsWordOrPhrase(string text, string phrase)
    {
        if (phrase.Contains(' '))
        {
            return text.Contains(phrase, StringComparison.Ordinal);
        }

        return ContainsWord(text, phrase);
    }
}
