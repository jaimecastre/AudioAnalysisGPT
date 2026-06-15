using System.Runtime.CompilerServices;
using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;

namespace AcousticCanvas.Tests;

public sealed class AgentSpectrogramToolTests
{
    [Fact]
    public void AgentToolRegistryIncludesRunSpectrogram()
    {
        var definition = AgentToolRegistry.GetToolDefinition("run_spectrogram");
        var promptSummary = AgentToolRegistry.BuildToolListSummaryForPrompt();

        Assert.NotNull(definition);
        Assert.Contains("spectrogram", definition.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run_spectrogram", promptSummary);
    }

    [Fact]
    public void PlannerPromptKeepsSpectrogramOnlyComparisonsNarrow()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a", "file-b"],
            ["a.wav", "b.wav"]
        );

        Assert.Contains("spectrogram-only comparison", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("run ONLY run_spectrogram", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "run_event_detection(kind=\"transient\")",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "energy at a frequency is present \"throughout\"",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "what causes this band in the spectrogram?",
            prompt,
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public void PlannerPromptTreatsSpectrogramDefinitionsAsNoAnalysisNeeded()
    {
        var prompt = AgentPromptBuilder.BuildPlannerSystemPrompt(
            AgentToolRegistry.BuildToolListSummaryForPrompt(),
            ["file-a"],
            ["a.wav"]
        );

        Assert.Contains("what is a spectrogram?", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("use no_analysis_needed", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "what does the spectrogram show for @file.wav?",
            prompt,
            StringComparison.OrdinalIgnoreCase
        );
        Assert.Contains("needs run_spectrogram", prompt, StringComparison.Ordinal);
    }

    [Fact]
    public void FinalAnswerPromptForbidsUnsupportedSpectrogramVisualClaims()
    {
        var prompt = AgentPromptBuilder.BuildFinalAnswerSystemPrompt();

        Assert.Contains(
            "does NOT contain per-frame energy values",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("Do NOT claim visible bursts", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "Duration and frame count describe time coverage/resolution only",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Frequency range is determined by sample rate/Nyquist",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "use transient/event counts if available",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains("do not assume the band exists", prompt, StringComparison.Ordinal);
        Assert.Contains(
            "it cannot prove it persists throughout time",
            prompt,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "No psychoacoustic metrics were computed",
            prompt,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task ToolExecutionServiceRunsFullFileSpectrogram()
    {
        var fileId = Guid.NewGuid().ToString("N")[..12];
        var storagePath = Path.Combine(
            Path.GetTempPath(),
            $"acousticcanvas_agent_spectrogram_{Guid.NewGuid():N}"
        );
        Directory.CreateDirectory(storagePath);
        await File.WriteAllBytesAsync(
            Path.Combine(storagePath, $"{fileId}_agent_spectrogram.wav"),
            BuildSineWaveBytes()
        );

        var audioFileRepository = BuildAudioFileRepository(storagePath);
        var soundQualityService = new SoundQualityAnalysisService(
            new FakeSoundQualityClient(),
            new SoundQualityCacheStore()
        );
        var importers = new List<ISignalFileImporter> { new WavSignalFileImporter() };
        var signalAnalysisService = new SignalAnalysisService(
            importers,
            new SignalFileCacheStore()
        );
        var analysisResultCache = new AnalysisResultCache();
        var toolExecutionService = new ToolExecutionService(
            audioFileRepository,
            signalAnalysisService,
            soundQualityService,
            importers,
            new SpectrogramCacheStore(),
            analysisResultCache
        );

        var toolOutput = await toolExecutionService.ExecuteToolAsync(
            new PlannerToolRequest
            {
                Name = "run_spectrogram",
                Arguments = new Dictionary<string, object?> { ["fileIds"] = new[] { fileId } },
            },
            CancellationToken.None
        );

        Assert.True(
            toolOutput.Status == "completed",
            $"Expected completed status, got '{toolOutput.Status}': {toolOutput.ErrorCode} {toolOutput.ErrorMessage}"
        );
        Assert.Equal("run_spectrogram", toolOutput.ToolName);
        Assert.NotNull(toolOutput.ResultData);

        var serializedData = JsonSerializer.Serialize(toolOutput.ResultData);
        var parsedData = JsonSerializer.Deserialize<JsonElement>(serializedData);
        var fileResult = parsedData.GetProperty("results")[0];
        Assert.Equal(fileId, fileResult.GetProperty("fileId").GetString());
        Assert.True(fileResult.GetProperty("region").GetProperty("endSeconds").GetDouble() > 0.9);
        Assert.Equal(44100, fileResult.GetProperty("parameters").GetProperty("fftSize").GetInt32());
        Assert.Equal("mel", fileResult.GetProperty("parameters").GetProperty("scale").GetString());
        Assert.True(fileResult.GetProperty("summary").GetProperty("frameCount").GetInt32() > 0);
        Assert.True(fileResult.GetProperty("summary").GetProperty("binCount").GetInt32() > 0);
        Assert.True(fileResult.GetProperty("summary").GetProperty("nyquistHz").GetDouble() > 0);
        Assert.StartsWith("spectrogram_", fileResult.GetProperty("dataRef").GetString());

        var resultId = fileResult.GetProperty("resultId").GetString();
        Assert.StartsWith("spectrogram_", resultId);
        var cachedResult = analysisResultCache.GetResult(resultId!);
        Assert.NotNull(cachedResult);
        Assert.Equal("spectrogram", cachedResult!.Type);
    }

    [Fact]
    public void EvidencePackageBuilderExtractsSpectrogramEvidence()
    {
        var toolOutput = new ToolExecutionOutput
        {
            ToolName = "run_spectrogram",
            Status = "completed",
            ResultRef = "spectrogram_12345678",
            ResultData = new
            {
                results = new[]
                {
                    new
                    {
                        fileId = "file123456789",
                        region = new
                        {
                            startSeconds = 0.0,
                            endSeconds = 1.0,
                            durationSeconds = 1.0,
                        },
                        parameters = new
                        {
                            fftSize = 2048,
                            overlap = 0.75,
                            scale = "mel",
                            gainDb = 20.0,
                            rangeDb = 80.0,
                        },
                        summary = new
                        {
                            frameCount = 42,
                            binCount = 1025,
                            nyquistHz = 24000.0,
                        },
                        dataRef = "spectrogram_abcdef12",
                        resultId = "spectrogram_0123456789abcdef0123456789abcdef",
                    },
                },
            },
        };

        var evidencePackage = EvidencePackageBuilder.Build(
            userQuestion: "Show me the spectrogram.",
            selectedFileIds: ["file123456789"],
            selectedFileNames: ["test_file.wav"],
            toolOutputs: [toolOutput]
        );

        Assert.Contains("run_spectrogram", evidencePackage.AnalysesRun);
        var evidence = Assert.Single(
            evidencePackage.KeyEvidence,
            item => item.Type == "spectrogram"
        );
        Assert.Equal("ev_spectrogram_file1234", evidence.EvidenceId);
        Assert.Equal("test_file.wav", evidence.Data["fileName"]);
        Assert.Equal(2048, evidence.Data["fftSize"]);
        Assert.Equal("mel", evidence.Data["scale"]);
        Assert.Equal(42, evidence.Data["frameCount"]);
        Assert.Equal(1025, evidence.Data["binCount"]);
        Assert.Equal(24000.0, evidence.Data["nyquistHz"]);
        Assert.Equal("spectrogram_abcdef12", evidence.Data["dataRef"]);
        Assert.Equal("spectrogram_0123456789abcdef0123456789abcdef", evidence.Data["resultId"]);
        Assert.DoesNotContain(
            evidencePackage.Limitations,
            limitation =>
                limitation.Contains("No psychoacoustic metrics", StringComparison.OrdinalIgnoreCase)
        );
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
        var repository = (AudioFileRepository)
            RuntimeHelpers.GetUninitializedObject(typeof(AudioFileRepository));
        var storagePathField =
            typeof(AudioFileRepository).GetField(
                "_storagePath",
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic
            )
            ?? throw new InvalidOperationException(
                "Could not locate AudioFileRepository storage path field."
            );
        storagePathField.SetValue(repository, storagePath);
        return repository;
    }

    private sealed class FakeSoundQualityClient : ISoundQualityClient
    {
        public Task<SoundQualityAnalysis> AnalyzeAsync(
            RunSoundQualityQuery query,
            CancellationToken cancellationToken
        )
        {
            throw new NotSupportedException("Sound quality is not used by spectrogram tests.");
        }
    }
}
