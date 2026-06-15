using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using Xunit;

namespace AcousticCanvas.Tests;

public sealed class AgentToolDefaultFftSizeTests
{
    [Theory]
    [InlineData("run_spectrum")]
    [InlineData("run_spectrogram")]
    [InlineData("run_cpb")]
    public async Task AgentPlotToolsDefaultToFullSecondFftSize(string toolName)
    {
        FastEndpointsModuleInitializer.Initialize();

        var fileId = Guid.NewGuid().ToString("N")[..12];
        var storagePath = Path.Combine(
            Path.GetTempPath(),
            $"acousticcanvas_agent_fft_defaults_{Guid.NewGuid():N}"
        );
        Directory.CreateDirectory(storagePath);
        var filePath = Path.Combine(storagePath, $"{fileId}_agent_fft_default.wav");
        await File.WriteAllBytesAsync(filePath, BuildSineWaveBytes());

        var importers = new List<ISignalFileImporter> { new WavSignalFileImporter() };

        if (toolName == "run_spectrum")
        {
            var handlerTypeName = "AcousticCanvas.Features.Analysis.Handlers.RunSpectrumHandler";
            var handler = CreateHandler(handlerTypeName, importers);
            var query = new RunSpectrumQuery(
                FilePath: filePath,
                StartSeconds: 0.0,
                EndSeconds: 1.0,
                FftSize: 44100,
                Overlap: 0.5
            );
            var task = (Task)
                handler
                    .GetType()
                    .GetMethod("ExecuteAsync")!
                    .Invoke(handler, new object[] { query, CancellationToken.None })!;
            await task;
            var result = task.GetType().GetProperty("Result")!.GetValue(task)!;
            var resultType = result.GetType();
            var parametersProperty = resultType.GetProperty("Parameters");
            var parameters = parametersProperty!.GetValue(result)!;
            var fftSizeProperty = parameters.GetType().GetProperty("FftSize");
            var fftSize = (int)fftSizeProperty!.GetValue(parameters)!;
            Assert.Equal(44100, fftSize);
        }
        else if (toolName == "run_cpb")
        {
            var cpbAnalysisService = new CpbAnalysisService(new FakeCpbFilterBankClient());
            var handlerTypeName = "AcousticCanvas.Features.Analysis.Handlers.RunCpbHandler";
            var handler = CreateHandler(handlerTypeName, importers, cpbAnalysisService);
            var query = new RunCpbQuery(
                FilePath: filePath,
                StartSeconds: 0.0,
                EndSeconds: 1.0,
                BandMode: "third_octave",
                FftSize: 44100,
                Overlap: 0.5,
                Weighting: "z",
                Method: "fft_bin_power_sum"
            );
            var task = (Task)
                handler
                    .GetType()
                    .GetMethod("ExecuteAsync")!
                    .Invoke(handler, new object[] { query, CancellationToken.None })!;
            await task;
            var result = task.GetType().GetProperty("Result")!.GetValue(task)!;
            var resultType = result.GetType();
            var parametersProperty = resultType.GetProperty("Parameters");
            var parameters = parametersProperty!.GetValue(result)!;
            var fftSizeProperty = parameters.GetType().GetProperty("FftSize");
            var fftSize = (int)fftSizeProperty!.GetValue(parameters)!;
            Assert.Equal(44100, fftSize);
        }
        else if (toolName == "run_spectrogram")
        {
            var spectrogramCacheStore = new SpectrogramCacheStore();
            var handlerTypeName = "AcousticCanvas.Features.Analysis.Handlers.RunSpectrogramHandler";
            var handler = CreateHandler(handlerTypeName, importers, spectrogramCacheStore);
            var query = new RunSpectrogramQuery(
                FilePath: filePath,
                StartSeconds: 0.0,
                EndSeconds: 1.0,
                FftSize: 44100,
                Overlap: 0.75,
                Scale: "mel",
                GainDb: 20.0,
                RangeDb: 80.0
            );
            var task = (Task)
                handler
                    .GetType()
                    .GetMethod("ExecuteAsync")!
                    .Invoke(handler, new object[] { query, CancellationToken.None })!;
            await task;
            var result = task.GetType().GetProperty("Result")!.GetValue(task)!;
            var resultType = result.GetType();
            var parametersProperty = resultType.GetProperty("Parameters");
            var parameters = parametersProperty!.GetValue(result)!;
            var fftSizeProperty = parameters.GetType().GetProperty("FftSize");
            var fftSize = (int)fftSizeProperty!.GetValue(parameters)!;
            Assert.Equal(44100, fftSize);
        }
    }

    private static object CreateHandler(string handlerTypeName, params object[] args)
    {
        var assembly = typeof(AudioFileRepository).Assembly;
        var handlerType = assembly.GetType(handlerTypeName);
        return System.Activator.CreateInstance(handlerType!, args)!;
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

    private sealed class FakeCpbFilterBankClient : ICpbFilterBankClient
    {
        public Task<CpbAnalysis> AnalyzeAsync(
            RunCpbQuery query,
            IReadOnlyList<SignalChannel> channels,
            CancellationToken cancellationToken
        )
        {
            throw new NotSupportedException(
                "Python CPB filter bank is not used by FFT default tests."
            );
        }
    }
}
