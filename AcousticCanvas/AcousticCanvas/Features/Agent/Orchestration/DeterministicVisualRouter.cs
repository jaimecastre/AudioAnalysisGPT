namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed record DeterministicVisualPlan
{
    public required IReadOnlyList<string> ToolNames { get; init; }
    public string Reason { get; init; } = "Visual request routed to analysis tools.";
}

public static class DeterministicVisualRouter
{
    private static readonly string[] ComparisonRequestPhrases =
    [
        "compare",
        "comparison",
        "contrast",
        "versus",
        "vs",
    ];

    private static readonly string[] SpectrumRequestPhrases =
    [
        "spectrum",
        "spectra",
        "fft",
        "frequency spectrum",
    ];

    private static readonly string[] SpectrogramRequestPhrases =
    [
        "spectrogram",
        "spectrograms",
        "time-frequency",
        "frequency over time",
    ];

    private static readonly string[] FileComparisonPhrases =
    [
        "file",
        "files",
        "loaded files",
        "these",
        "both",
    ];

    private static readonly string[] VisualRequestPhrases =
    [
        "graph",
        "graphs",
        "plot",
        "plots",
        "chart",
        "charts",
        "visualize",
        "visualise",
        "show me visuals",
    ];

    private static readonly string[] DefinitionPhrases =
    [
        "what is",
        "what's",
        "define",
        "explain",
        "how does",
    ];

    public static DeterministicVisualPlan? TryRoute(string userQuestion)
    {
        var normalized = userQuestion.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            return null;
        }

        if (PhraseMatcher.ContainsAnyWordOrPhrase(normalized, DefinitionPhrases))
        {
            return null;
        }

        if (
            PhraseMatcher.ContainsAnyWordOrPhrase(normalized, ComparisonRequestPhrases)
            && PhraseMatcher.ContainsAnyWordOrPhrase(normalized, SpectrumRequestPhrases)
            && !PhraseMatcher.ContainsAnyWordOrPhrase(normalized, SpectrogramRequestPhrases)
        )
        {
            return new DeterministicVisualPlan
            {
                ToolNames = [AgentToolNames.RunSpectrum],
                Reason = "Spectrum comparison request routed to FFT spectrum analysis.",
            };
        }

        if (
            PhraseMatcher.ContainsAnyWordOrPhrase(normalized, ComparisonRequestPhrases)
            && PhraseMatcher.ContainsAnyWordOrPhrase(normalized, FileComparisonPhrases)
        )
        {
            return new DeterministicVisualPlan
            {
                ToolNames =
                [
                    AgentToolNames.GetMetadata,
                    AgentToolNames.RunBasicMetrics,
                    AgentToolNames.RunSpectrum,
                    AgentToolNames.RunCpb,
                    AgentToolNames.RunSoundQualityMetrics,
                    AgentToolNames.RunEventDetection,
                ],
                Reason = "Broad file comparison routed to the full comparison evidence suite.",
            };
        }

        if (!PhraseMatcher.ContainsAnyWordOrPhrase(normalized, VisualRequestPhrases))
        {
            return null;
        }

        return new DeterministicVisualPlan
        {
            ToolNames = [AgentToolNames.RunSpectrum, AgentToolNames.RunSpectrogram],
            Reason = "Generic graph request routed to visual analysis tools.",
        };
    }
}
