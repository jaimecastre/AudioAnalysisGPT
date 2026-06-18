namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentToolDefinition
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required string PromptDescription { get; init; }
    public required string ArgumentsPrompt { get; init; }
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
                PromptDescription = "Return file metadata: duration, sample rate, channels, bit depth.",
                ArgumentsPrompt = "{ \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
                MaxFileCount = 10,
                MaxFileDurationSeconds = double.MaxValue,
            },
            ["run_basic_metrics"] = new AgentToolDefinition
            {
                Name = "run_basic_metrics",
                Description =
                    "Compute peak level, RMS level, crest factor, DC offset, and digital clipping detection. Supports optional startSeconds and endSeconds to restrict analysis to a time region.",
                PromptDescription =
                    "Compute peak level, RMS, crest factor, DC offset, clipping detection.",
                ArgumentsPrompt =
                    "{ \"fileIds\": [\"<id1>\"], \"startSeconds\": 0.0, \"endSeconds\": 5.0 }  ← fileIds required; startSeconds/endSeconds optional (omit to analyse full file)",
                MaxFileCount = 10,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_spectrum"] = new AgentToolDefinition
            {
                Name = "run_spectrum",
                Description =
                    "Compute averaged FFT spectrum with tonal peak detection. Supports optional startSeconds and endSeconds to restrict analysis to a time region.",
                PromptDescription = "Compute averaged FFT spectrum with tonal peak detection.",
                ArgumentsPrompt =
                    "{ \"fileIds\": [\"<id1>\"], \"startSeconds\": 0.0, \"endSeconds\": 5.0 }  ← fileIds required; startSeconds/endSeconds optional (omit to analyse full file)",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_spectrogram"] = new AgentToolDefinition
            {
                Name = "run_spectrogram",
                Description = "Compute full-file spectrogram time-frequency summary.",
                PromptDescription = "Compute full-file spectrogram time-frequency summary.",
                ArgumentsPrompt = "{ \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_cpb"] = new AgentToolDefinition
            {
                Name = "run_cpb",
                Description =
                    "Compute octave or 1/3-octave constant-percentage-bandwidth band levels.",
                PromptDescription = "Compute octave or 1/3-octave band levels.",
                ArgumentsPrompt = "{ \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_sound_quality_metrics"] = new AgentToolDefinition
            {
                Name = "run_sound_quality_metrics",
                Description =
                    "Compute MoSQITo psychoacoustic loudness, sharpness, and roughness metrics.",
                PromptDescription =
                    "Compute MoSQITo loudness, sharpness, and roughness.",
                ArgumentsPrompt = "{ \"fileIds\": [\"<id1>\", \"<id2>\"] }  ← fileIds MUST be a JSON array of strings",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_event_detection"] = new AgentToolDefinition
            {
                Name = "run_event_detection",
                Description =
                    "Detect audio events: clipping, silence gaps, loudest region, or transient onsets.",
                PromptDescription = "Detect audio events: clipping, silence, loudest, transient.",
                ArgumentsPrompt = "{ \"fileId\": \"<id>\", \"kind\": \"clipping\" }  ← fileId is a single string, kind is one of: clipping, silence, loudest, transient",
                MaxFileCount = 4,
                MaxFileDurationSeconds = 300.0,
            },
            ["run_findings"] = new AgentToolDefinition
            {
                Name = "run_findings",
                Description =
                    "Run the full findings pipeline for a single file: detects clipping, silence gaps, high crest factor, DC offset, and tonal peaks. Returns a structured list of findings with severity, confidence, evidence, and suggested next steps.",
                PromptDescription =
                    "Run the full findings pipeline for one file (clipping, silence, crest factor, DC offset, tonal peaks).",
                ArgumentsPrompt = "{ \"fileId\": \"<id>\" }  ← fileId is a single string",
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
        var lines = new List<string>();
        foreach (var toolDefinition in AllowedTools.Values)
        {
            lines.Add($"- {toolDefinition.Name}: {toolDefinition.PromptDescription}");
            lines.Add($"  Arguments: {toolDefinition.ArgumentsPrompt}");
        }

        return string.Join("\n", lines);
    }
}
