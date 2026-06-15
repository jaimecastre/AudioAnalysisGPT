using System.Text.Json;
using System.Runtime.CompilerServices;
using AcousticCanvas.Features.Agent.Orchestration;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;

namespace AcousticCanvas.Tests;

public sealed class AgentSoundQualityToolTests
{
    [Fact]
    public void AgentToolRegistryIncludesRunSoundQualityMetrics()
    {
        var definition = AgentToolRegistry.GetToolDefinition("run_sound_quality_metrics");
        var promptSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();

        Assert.NotNull(definition);
        Assert.Contains("loudness", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sharpness", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("roughness", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_sound_quality_metrics", promptSummary);
    }

    [Fact]
    public void PlannerPromptCoversSoundQualityScenarios()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a", "file-b"],
            ["a.wav", "b.wav"]);

        Assert.Contains("loudness, sharpness, roughness", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("perceived quality", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("psychoacoustic questions", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_sound_quality_metrics on each file", prompt, StringComparison.Ordinal);
        Assert.Contains("sound-quality comparisons", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_sound_quality_metrics on all referenced or loaded files", prompt, StringComparison.Ordinal);
        Assert.Contains("unsupported sound-quality conversions", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("harshness or spectral questions", prompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void FinalAnswerPromptCoversSoundQualityInterpretationRules()
    {
        var prompt = AgentPromptBuilder.BuildFinalAnswerSystemPrompt();

        Assert.Contains("When a sound_quality_comparison evidence item exists", prompt, StringComparison.Ordinal);
        Assert.Contains("always cite loudness/sharpness/roughness deltas with units", prompt, StringComparison.Ordinal);
        Assert.Contains("sone is NOT convertible to LUFS", prompt, StringComparison.Ordinal);
        Assert.Contains("For harshness comparisons: use sharpness", prompt, StringComparison.Ordinal);
        Assert.Contains("Do NOT cite peakFrequencyHz as a harshness proxy", prompt, StringComparison.Ordinal);
        Assert.Contains("Sound-quality evidence is psychoacoustic metric evidence", prompt, StringComparison.Ordinal);
        Assert.Contains("they do not identify the mechanical/electrical source", prompt, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ToolExecutionServiceRunsFullFileSoundQualityMetrics()
    {
        var fileId = Guid.NewGuid().ToString("N")[..12];
        var storagePath = Path.Combine(Path.GetTempPath(), $"acousticcanvas_agent_sq_{Guid.NewGuid():N}");
        Directory.CreateDirectory(storagePath);
        await File.WriteAllBytesAsync(Path.Combine(storagePath, $"{fileId}_agent_sound_quality.wav"), BuildSineWaveBytes());
        var audioFileRepository = BuildAudioFileRepository(storagePath);
        var fakeClient = new FakeSoundQualityClient();
        var soundQualityService = new SoundQualityAnalysisService(fakeClient, new SoundQualityCacheStore());
        var importers = new List<ISignalFileImporter> { new WavSignalFileImporter() };
        var signalAnalysisService = new SignalAnalysisService(importers, new SignalFileCacheStore());
        var toolExecutionService = new ToolExecutionService(
            audioFileRepository,
            signalAnalysisService,
            soundQualityService,
            importers,
            new SpectrogramCacheStore(),
            new AnalysisResultCache());

        var toolOutput = await toolExecutionService.ExecuteToolAsync(
            new PlannerToolRequest
            {
                Name = "run_sound_quality_metrics",
                Arguments = new Dictionary<string, object?>
                {
                    ["fileIds"] = new[] { fileId },
                },
            },
            CancellationToken.None);

        Assert.Equal("completed", toolOutput.Status);
        Assert.Equal("run_sound_quality_metrics", toolOutput.ToolName);
        Assert.NotNull(toolOutput.ResultData);
        Assert.Equal(0.0, fakeClient.LastQuery?.StartSeconds);
        Assert.True(fakeClient.LastQuery?.EndSeconds > 0.9);

        var serializedData = JsonSerializer.Serialize(toolOutput.ResultData);
        var parsedData = JsonSerializer.Deserialize<JsonElement>(serializedData);
        var fileResult = parsedData.GetProperty("results")[0];
        Assert.Equal(fileId, fileResult.GetProperty("fileId").GetString());
        Assert.Equal(10.5, fileResult.GetProperty("loudness").GetProperty("value").GetDouble());
        Assert.Equal(1.25, fileResult.GetProperty("sharpness").GetProperty("value").GetDouble());
        Assert.Equal(0.75, fileResult.GetProperty("roughness").GetProperty("value").GetDouble());
    }

    [Fact]
    public void EvidencePackageBuilderExtractsSoundQualityEvidence()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_sound_quality_metrics",
            Status = "completed",
            ResultRef = "sound_quality_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "file123456789",
                        region = new { startSeconds = 0.0, endSeconds = 1.0, durationSeconds = 1.0 },
                        method = "mosqito_stationary_zwicker",
                        loudness = new { value = 10.5, unit = "sone", method = "MoSQITo loudness_zwst" },
                        sharpness = new { value = 1.25, unit = "acum", method = "MoSQITo sharpness_din_from_loudness" },
                        roughness = new { value = 0.75, unit = "asper", method = "MoSQITo roughness_dw" },
                        limitations = new[] { "Uncalibrated digital-amplitude WAV samples." },
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "What is the loudness and roughness?",
            selectedFileIds: ["file123456789"],
            selectedFileNames: ["test_file.wav"],
            toolOutputs: [toolOutput]);

        Assert.Contains("run_sound_quality_metrics", evidencePackage.AnalysesRun);
        Assert.DoesNotContain(evidencePackage.Limitations, limitation => limitation.Contains("No psychoacoustic metrics", StringComparison.OrdinalIgnoreCase));
        var evidence = Assert.Single(evidencePackage.KeyEvidence, item => item.Type == "sound_quality");
        Assert.Equal("ev_sound_quality_file1234", evidence.EvidenceId);
        Assert.Equal(10.5, evidence.Data["loudnessSone"]);
        Assert.Equal(1.25, evidence.Data["sharpnessAcum"]);
        Assert.Equal(0.75, evidence.Data["roughnessAsper"]);
        Assert.Equal("MoSQITo roughness_dw", evidence.Data["roughnessMethod"]);
    }

    [Fact]
    public void EvidencePackageBuilderEmitsSoundQualityComparisonEvidenceForTwoFiles()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_sound_quality_metrics",
            Status = "completed",
            ResultRef = "sound_quality_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "fileA123456",
                        region = new { startSeconds = 0.0, endSeconds = 1.0, durationSeconds = 1.0 },
                        method = "mosqito_stationary_zwicker",
                        loudness = new { value = 10.5, unit = "sone", method = "MoSQITo loudness_zwst" },
                        sharpness = new { value = 1.25, unit = "acum", method = "MoSQITo sharpness_din_from_loudness" },
                        roughness = new { value = 0.75, unit = "asper", method = "MoSQITo roughness_dw" },
                    },
                    new
                    {
                        fileId = "fileB123456",
                        region = new { startSeconds = 0.0, endSeconds = 1.0, durationSeconds = 1.0 },
                        method = "mosqito_stationary_zwicker",
                        loudness = new { value = 12.25, unit = "sone", method = "MoSQITo loudness_zwst" },
                        sharpness = new { value = 0.95, unit = "acum", method = "MoSQITo sharpness_din_from_loudness" },
                        roughness = new { value = 0.04, unit = "asper", method = "MoSQITo roughness_dw" },
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "Compare sound quality.",
            selectedFileIds: ["fileA123456", "fileB123456"],
            selectedFileNames: ["a.wav", "b.wav"],
            toolOutputs: [toolOutput]);

        Assert.Equal(2, evidencePackage.KeyEvidence.Count(item => item.Type == "sound_quality"));
        var comparison = Assert.Single(evidencePackage.KeyEvidence, item => item.Type == "sound_quality_comparison");
        Assert.Equal("a.wav", comparison.Data["fileNameA"]);
        Assert.Equal("b.wav", comparison.Data["fileNameB"]);
        Assert.Equal(10.5, comparison.Data["loudnessASone"]);
        Assert.Equal(12.25, comparison.Data["loudnessBSone"]);
        Assert.Equal(1.75, comparison.Data["loudnessDeltaSone"]);
        Assert.Equal(-0.3, comparison.Data["sharpnessDeltaAcum"]);
        Assert.Equal(-0.71, comparison.Data["roughnessDeltaAsper"]);
        Assert.Equal("fileB123456", comparison.Data["louderFileId"]);
        Assert.Equal("fileA123456", comparison.Data["sharperFileId"]);
        Assert.Equal("fileA123456", comparison.Data["rougherFileId"]);
    }

    private static byte[] BuildSineWaveBytes()
    {
        const int sampleRate = 48_000;
        const int sampleCount = sampleRate;
        using var memoryStream = new MemoryStream();
        using var writer = new BinaryWriter(memoryStream);
        var dataByteCount = sampleCount * sizeof(short);

        writer.Write("RIFF"u8.ToArray());
        writer.Write(36 + dataByteCount);
        writer.Write("WAVE"u8.ToArray());
        writer.Write("fmt "u8.ToArray());
        writer.Write(16);
        writer.Write((short)1);
        writer.Write((short)1);
        writer.Write(sampleRate);
        writer.Write(sampleRate * sizeof(short));
        writer.Write((short)sizeof(short));
        writer.Write((short)16);
        writer.Write("data"u8.ToArray());
        writer.Write(dataByteCount);

        for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++)
        {
            var sample = 0.1 * Math.Sin(2.0 * Math.PI * 1000.0 * sampleIndex / sampleRate);
            writer.Write((short)Math.Round(sample * short.MaxValue));
        }

        return memoryStream.ToArray();
    }

    private static AudioFileRepository BuildAudioFileRepository(string storagePath)
    {
        var repository = (AudioFileRepository)RuntimeHelpers.GetUninitializedObject(typeof(AudioFileRepository));
        var storagePathField = typeof(AudioFileRepository).GetField("_storagePath", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("Could not locate AudioFileRepository storage path field.");
        storagePathField.SetValue(repository, storagePath);
        return repository;
    }

    private sealed class FakeSoundQualityClient : ISoundQualityClient
    {
        public RunSoundQualityQuery? LastQuery { get; private set; }

        public Task<SoundQualityAnalysis> AnalyzeAsync(RunSoundQualityQuery query, CancellationToken cancellationToken)
        {
            LastQuery = query;
            var analysis = new SoundQualityAnalysis
            {
                Parameters = new SoundQualityParameters
                {
                    Method = "mosqito_stationary_zwicker",
                    Library = "MoSQITo",
                    StartTimeSeconds = query.StartSeconds,
                    EndTimeSeconds = query.EndSeconds,
                    SampleRate = 48_000,
                    Limitations = ["Uncalibrated digital-amplitude WAV samples."],
                },
                Region = new TimeRange
                {
                    StartSeconds = query.StartSeconds,
                    EndSeconds = query.EndSeconds,
                    DurationSeconds = query.EndSeconds - query.StartSeconds,
                },
                Loudness = new SoundQualityMetric
                {
                    Name = "Stationary loudness",
                    Value = 10.5,
                    Unit = "sone",
                    Method = "MoSQITo loudness_zwst",
                },
                Sharpness = new SoundQualityMetric
                {
                    Name = "DIN sharpness",
                    Value = 1.25,
                    Unit = "acum",
                    Method = "MoSQITo sharpness_din_from_loudness",
                },
                Roughness = new SoundQualityMetric
                {
                    Name = "Daniel-Weber roughness",
                    Value = 0.75,
                    Unit = "asper",
                    Method = "MoSQITo roughness_dw",
                },
            };

            return Task.FromResult(analysis);
        }
    }
}
