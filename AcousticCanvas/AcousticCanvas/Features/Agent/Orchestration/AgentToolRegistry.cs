namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentToolDefinition
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required int MaxFileCount { get; init; }
    public required double MaxFileDurationSeconds { get; init; }
}

public static class AgentToolRegistry
{
    private static readonly IReadOnlyDictionary<string, AgentToolDefinition> AllowedTools =
        new Dictionary<string, AgentToolDefinition>
        {
            ["get_metadata"] = new AgentToolDefinition
            {
                Name = "get_metadata",
                Description = "Return file metadata: duration, sample rate, channels, bit depth.",
                MaxFileCount = 10,
                MaxFileDurationSeconds = double.MaxValue,
            },
            ["run_basic_metrics"] = new AgentToolDefinition
            {
                Name = "run_basic_metrics",
                Description =
                    "Compute peak level, RMS level, crest factor, DC offset, and digital clipping detection. Supports optional startSeconds and endSeconds to restrict analysis to a time region.",
                MaxFileCount = 10,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_spectrum"] = new AgentToolDefinition
            {
                Name = "run_spectrum",
                Description =
                    "Compute averaged FFT spectrum with tonal peak detection. Supports optional startSeconds and endSeconds to restrict analysis to a time region.",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_spectrogram"] = new AgentToolDefinition
            {
                Name = "run_spectrogram",
                Description = "Compute full-file spectrogram time-frequency summary.",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_cpb"] = new AgentToolDefinition
            {
                Name = "run_cpb",
                Description =
                    "Compute octave or 1/3-octave constant-percentage-bandwidth band levels.",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_sound_quality_metrics"] = new AgentToolDefinition
            {
                Name = "run_sound_quality_metrics",
                Description =
                    "Compute MoSQITo psychoacoustic loudness, sharpness, and roughness metrics.",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_event_detection"] = new AgentToolDefinition
            {
                Name = "run_event_detection",
                Description =
                    "Detect audio events: clipping, silence gaps, loudest region, or transient onsets.",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_findings"] = new AgentToolDefinition
            {
                Name = "run_findings",
                Description =
                    "Run the full findings pipeline for a single file: detects clipping, silence gaps, high crest factor, DC offset, and tonal peaks. Returns a structured list of findings with severity, confidence, evidence, and suggested next steps.",
                MaxFileCount = 1,
                MaxFileDurationSeconds = 300.0,
            },
        };

    public static bool IsToolAllowed(string toolName)
    {
        return AllowedTools.ContainsKey(toolName);
    }

    public static AgentToolDefinition? GetToolDefinition(string toolName)
    {
        AllowedTools.TryGetValue(toolName, out var definition);
        return definition;
    }

    public static IReadOnlyList<string> GetAllAllowedToolNames()
    {
        var toolNames = new List<string>();
        foreach (var toolName in AllowedTools.Keys)
        {
            toolNames.Add(toolName);
        }
        return toolNames;
    }

    public static string BuildToolListSummaryForPrompt()
    {
        var lines = new List<string>
        {
            "- get_metadata: Return file metadata: duration, sample rate, channels, bit depth.",
            "  Arguments: { \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
            "- run_basic_metrics: Compute peak level, RMS, crest factor, DC offset, clipping detection.",
            "  Arguments: { \"fileIds\": [\"<id1>\"], \"startSeconds\": 0.0, \"endSeconds\": 5.0 }  ← fileIds required; startSeconds/endSeconds optional (omit to analyse full file)",
            "- run_spectrum: Compute averaged FFT spectrum with tonal peak detection.",
            "  Arguments: { \"fileIds\": [\"<id1>\"], \"startSeconds\": 0.0, \"endSeconds\": 5.0 }  ← fileIds required; startSeconds/endSeconds optional (omit to analyse full file)",
            "- run_spectrogram: Compute full-file spectrogram time-frequency summary.",
            "  Arguments: { \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
            "- run_cpb: Compute octave or 1/3-octave band levels.",
            "  Arguments: { \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
            "- run_sound_quality_metrics: Compute MoSQITo loudness, sharpness, and roughness.",
            "  Arguments: { \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
            "- run_event_detection: Detect audio events: clipping, silence, loudest, transient.",
            "  Arguments: { \"fileId\": \"<id>\", \"kind\": \"clipping\" }  ← fileId is a single string, kind is one of: clipping, silence, loudest, transient",
            "- run_findings: Run the full findings pipeline for one file (clipping, silence, crest factor, DC offset, tonal peaks).",
            "  Arguments: { \"fileId\": \"<id>\" }  ← fileId is a single string",
        };
        return string.Join("\n", lines);
    }
}
