using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class PhraseMatcherTests
{
    [Fact]
    public void ContainsAnyWordOrPhraseDoesNotMatchWordInsideAnotherWord()
    {
        var matches = PhraseMatcher.ContainsAnyWordOrPhrase(
            "compare the spectrograms",
            ["spectrum"]
        );

        Assert.False(matches);
    }

    [Fact]
    public void ContainsAnyWordOrPhraseMatchesWholeWord()
    {
        var matches = PhraseMatcher.ContainsAnyWordOrPhrase("compare the spectrum", ["spectrum"]);

        Assert.True(matches);
    }

    [Fact]
    public void ContainsAnyWordOrPhraseMatchesMultiWordPhrase()
    {
        var matches = PhraseMatcher.ContainsAnyWordOrPhrase("show me visuals", ["show me visuals"]);

        Assert.True(matches);
    }

    [Fact]
    public void ContainsAnySubstringMatchesInsideWordForBroadGuards()
    {
        var matches = PhraseMatcher.ContainsAnySubstring("this sounds harsh", ["sound"]);

        Assert.True(matches);
    }
}
