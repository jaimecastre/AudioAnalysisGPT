using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using Microsoft.Extensions.Configuration;

namespace AcousticCanvas.Tests;

public sealed class SoundQualityAnalysisServiceTests
{
    [Fact]
    public async Task MosqitoSidecarReturnsPositiveLoudnessAndSharpness()
    {
        var fixturePath = WriteSineWaveFixture(frequencyHz: 1000.0, amplitude: 0.1);
        var service = new SoundQualityAnalysisService(BuildPythonClient());
        var query = BuildQuery(fixturePath);

        var result = await service.AnalyzeAsync(query, CancellationToken.None);

        Assert.Equal("mosqito_stationary_zwicker", result.Parameters.Method);
        Assert.True(result.Loudness.Value > 0.0);
        Assert.True(result.Sharpness.Value > 0.0);
        Assert.Equal("sone", result.Loudness.Unit);
        Assert.Equal("acum", result.Sharpness.Unit);
        Assert.NotEmpty(result.Parameters.Limitations);
    }

    [Fact]
    public async Task MosqitoSidecarReportsHigherSharpnessForHighFrequencySine()
    {
        var lowFixturePath = WriteSineWaveFixture(frequencyHz: 500.0, amplitude: 0.1);
        var highFixturePath = WriteSineWaveFixture(frequencyHz: 4000.0, amplitude: 0.1);
        var service = new SoundQualityAnalysisService(BuildPythonClient());

        var lowResult = await service.AnalyzeAsync(BuildQuery(lowFixturePath), CancellationToken.None);
        var highResult = await service.AnalyzeAsync(BuildQuery(highFixturePath), CancellationToken.None);

        Assert.True(highResult.Sharpness.Value > lowResult.Sharpness.Value);
    }

    private static PythonSoundQualityClient BuildPythonClient()
    {
        var repositoryRoot = FindRepositoryRoot();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PythonSidecar:Executable"] = Path.Combine(repositoryRoot, "AcousticCanvas", ".venv", "bin", "python"),
                ["PythonSidecar:SoundQualityScript"] = Path.Combine(repositoryRoot, "AcousticCanvas", "AcousticCanvas.ML", "sound_quality.py"),
            })
            .Build();

        return new PythonSoundQualityClient(configuration);
    }

    private static RunSoundQualityQuery BuildQuery(string fixturePath)
    {
        return new RunSoundQualityQuery(
            FilePath: fixturePath,
            StartSeconds: 0.0,
            EndSeconds: 1.0,
            Method: "mosqito_stationary_zwicker");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var projectContextPath = Path.Combine(directory.FullName, "AcousticCanvas", "PROJECT_CONTEXT.md");
            if (File.Exists(projectContextPath))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate repository root containing AcousticCanvas/PROJECT_CONTEXT.md.");
    }

    private static string WriteSineWaveFixture(double frequencyHz, double amplitude)
    {
        const int sampleRate = 48_000;
        const int sampleCount = sampleRate;
        var filePath = Path.Combine(Path.GetTempPath(), $"acousticcanvas_sq_{frequencyHz:0}_hz_{Guid.NewGuid():N}.wav");

        using var fileStream = File.Create(filePath);
        using var writer = new BinaryWriter(fileStream);
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
            var sample = amplitude * Math.Sin(2.0 * Math.PI * frequencyHz * sampleIndex / sampleRate);
            writer.Write((short)Math.Round(sample * short.MaxValue));
        }

        return filePath;
    }
}
