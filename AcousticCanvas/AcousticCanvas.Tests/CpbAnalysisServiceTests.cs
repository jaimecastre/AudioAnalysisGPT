using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;
using Microsoft.Extensions.Configuration;

namespace AcousticCanvas.Tests;

public sealed class CpbAnalysisServiceTests
{
    [Fact]
    public async Task UsesFftBinPowerSumMethodByDefault()
    {
        var service = new CpbAnalysisService(new UnavailableFilterBankClient());
        var channel = BuildSineChannel();
        var query = new RunCpbQuery(
            FilePath: "test.wav",
            StartSeconds: 0.0,
            EndSeconds: 1.0,
            BandMode: "third_octave",
            FftSize: 8192,
            Overlap: 0.5,
            Weighting: "z",
            Method: "fft_bin_power_sum"
        );

        var result = await service.AnalyzeAsync(query, [channel], CancellationToken.None);

        Assert.Equal("fft_bin_power_sum_nominal_fractional_octave", result.Parameters.Method);
        Assert.Equal("z", result.Parameters.Weighting);
        Assert.NotEmpty(result.Channels[0].Bands);
    }

    [Fact]
    public async Task PythonFilterBankMethodReturnsClearUnavailableError()
    {
        var service = new CpbAnalysisService(new UnavailableFilterBankClient());
        var channel = BuildSineChannel();
        var query = new RunCpbQuery(
            FilePath: "test.wav",
            StartSeconds: 0.0,
            EndSeconds: 1.0,
            BandMode: "third_octave",
            FftSize: 8192,
            Overlap: 0.5,
            Weighting: "a",
            Method: "python_filter_bank"
        );

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AnalyzeAsync(query, [channel], CancellationToken.None)
        );

        Assert.Contains("Python CPB filter-bank sidecar unavailable", exception.Message);
        Assert.Contains("PyOctaveBand", exception.Message);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task PythonFilterBankPeaksAtOneKilohertzForOneKilohertzSine()
    {
        var fixturePath = WriteSineWaveFixture(frequencyHz: 1000.0, amplitude: 0.5);
        var service = new CpbAnalysisService(BuildPythonClient());
        var channel = BuildSineChannel();
        var query = BuildPythonFilterBankQuery(fixturePath, weighting: "z");

        var result = await service.AnalyzeAsync(query, [channel], CancellationToken.None);

        var highestBand = result
            .Channels[0]
            .Bands.Where(band => band.LevelDb.HasValue)
            .MaxBy(band => band.LevelDb!.Value);

        Assert.NotNull(highestBand);
        Assert.Equal("python_filter_bank_pyoctaveband", result.Parameters.Method);
        Assert.Equal("z", result.Parameters.Weighting);
        Assert.InRange(highestBand!.CenterFrequencyHz, 890.0, 1125.0);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task PythonFilterBankAWeightingAttenuatesOneHundredHertzComparedWithZWeighting()
    {
        var fixturePath = WriteSineWaveFixture(frequencyHz: 100.0, amplitude: 0.5);
        var service = new CpbAnalysisService(BuildPythonClient());
        var channel = BuildSineChannel();
        var zQuery = BuildPythonFilterBankQuery(fixturePath, weighting: "z");
        var aQuery = BuildPythonFilterBankQuery(fixturePath, weighting: "a");

        var zResult = await service.AnalyzeAsync(zQuery, [channel], CancellationToken.None);
        var aResult = await service.AnalyzeAsync(aQuery, [channel], CancellationToken.None);

        var zBand = FindBand(zResult, 100.0);
        var aBand = FindBand(aResult, 100.0);

        Assert.NotNull(zBand.LevelDb);
        Assert.NotNull(aBand.LevelDb);
        Assert.Equal("a", aResult.Parameters.Weighting);
        Assert.True(aBand.LevelDb < zBand.LevelDb - 15.0);
    }

    private sealed class UnavailableFilterBankClient : ICpbFilterBankClient
    {
        public Task<CpbAnalysis> AnalyzeAsync(
            RunCpbQuery query,
            IReadOnlyList<SignalChannel> channels,
            CancellationToken cancellationToken
        )
        {
            throw new InvalidOperationException(
                "Python CPB filter-bank sidecar unavailable. Install PyOctaveBand and configure the sidecar before selecting python_filter_bank."
            );
        }
    }

    private static PythonCpbFilterBankClient BuildPythonClient()
    {
        var repositoryRoot = FindRepositoryRoot();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["PythonSidecar:Executable"] = Path.Combine(
                        repositoryRoot,
                        "AcousticCanvas",
                        ".venv",
                        "bin",
                        "python"
                    ),
                    ["PythonSidecar:CpbFilterBankScript"] = Path.Combine(
                        repositoryRoot,
                        "AcousticCanvas",
                        "AcousticCanvas.ML",
                        "cpb_filter_bank.py"
                    ),
                }
            )
            .Build();

        return new PythonCpbFilterBankClient(configuration);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var projectContextPath = Path.Combine(
                directory.FullName,
                "AcousticCanvas",
                "PROJECT_CONTEXT.md"
            );
            if (File.Exists(projectContextPath))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            "Could not locate repository root containing AcousticCanvas/PROJECT_CONTEXT.md."
        );
    }

    private static RunCpbQuery BuildPythonFilterBankQuery(string fixturePath, string weighting)
    {
        return new RunCpbQuery(
            FilePath: fixturePath,
            StartSeconds: 0.0,
            EndSeconds: 1.0,
            BandMode: "third_octave",
            FftSize: 8192,
            Overlap: 0.5,
            Weighting: weighting,
            Method: "python_filter_bank"
        );
    }

    private static string WriteSineWaveFixture(double frequencyHz, double amplitude)
    {
        const int sampleRate = 48_000;
        const int sampleCount = sampleRate;
        var filePath = Path.Combine(
            Path.GetTempPath(),
            $"acousticcanvas_cpb_{frequencyHz:0}_hz_{Guid.NewGuid():N}.wav"
        );

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
            var sample =
                amplitude * Math.Sin(2.0 * Math.PI * frequencyHz * sampleIndex / sampleRate);
            writer.Write((short)Math.Round(sample * short.MaxValue));
        }

        return filePath;
    }

    private static CpbBand FindBand(CpbAnalysis analysis, double centerFrequencyHz)
    {
        return analysis
                .Channels[0]
                .Bands.MinBy(band => Math.Abs(band.CenterFrequencyHz - centerFrequencyHz))
            ?? throw new InvalidOperationException($"No CPB band near {centerFrequencyHz} Hz.");
    }

    private static SignalChannel BuildSineChannel()
    {
        const int sampleRate = 48_000;
        const int sampleCount = sampleRate;
        var samples = new float[sampleCount];

        for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++)
        {
            samples[sampleIndex] = (float)(
                0.5 * Math.Sin(2.0 * Math.PI * 1000.0 * sampleIndex / sampleRate)
            );
        }

        return new SignalChannel
        {
            Id = "ch1",
            Name = "Mono",
            SampleRate = sampleRate,
            SampleCount = sampleCount,
            Quantity = "digital_amplitude",
            Unit = "FS",
            DbReference = new DbReference
            {
                Value = 1.0,
                Unit = "FS",
                DbUnit = "dBFS",
            },
            Calibration = new CalibrationInfo
            {
                IsCalibrated = false,
                Scale = 1.0,
                Offset = 0.0,
            },
            Samples = samples,
        };
    }
}
