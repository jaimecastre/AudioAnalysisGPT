using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;
using NAudio.Wave;

namespace AcousticCanvas.Features.Analysis.Importers;

public sealed class WavSignalFileImporter : ISignalFileImporter
{
    private static readonly HashSet<string> SupportedExtensions = new(
        StringComparer.OrdinalIgnoreCase
    )
    {
        ".wav",
        ".wave",
    };

    public bool CanImport(string filePath)
    {
        var extension = Path.GetExtension(filePath);
        return SupportedExtensions.Contains(extension);
    }

    public SignalFile Import(string filePath)
    {
        using var reader = new AudioFileReader(filePath);

        var format = reader.WaveFormat;
        var sampleRate = format.SampleRate;
        var channelCount = format.Channels;
        var bitDepth = format.BitsPerSample;
        var durationSeconds = reader.TotalTime.TotalSeconds;
        var totalFrames = (long)(durationSeconds * sampleRate);
        var totalSamples = totalFrames * channelCount;
        var fileSizeBytes = new FileInfo(filePath).Length;
        var encodingFormat = ResolveEncodingFormat(format.Encoding);

        // Read all interleaved samples at once
        var allSamples = ReadAllSamples(reader, totalSamples);

        var channels = BuildChannels(allSamples, channelCount, sampleRate, totalFrames);

        var fileInfo = new FileInfoAnalysis
        {
            FileName = Path.GetFileName(filePath),
            FileExtension = Path.GetExtension(filePath),
            FileSizeBytes = fileSizeBytes,
            ContainerFormat = "WAV",
            EncodingFormat = encodingFormat,
            DurationSeconds = durationSeconds,
            SampleRate = sampleRate,
            ChannelCount = channelCount,
            BitDepth = bitDepth,
            TotalFrames = totalFrames,
            TotalSamples = totalSamples,
        };

        return new SignalFile { FileInfo = fileInfo, Channels = channels };
    }

    private static float[] ReadAllSamples(AudioFileReader reader, long expectedSampleCount)
    {
        var bufferSize = 4096;
        var buffer = new float[bufferSize];
        var allSamples = new List<float>((int)Math.Min(expectedSampleCount, int.MaxValue));

        while (true)
        {
            var samplesRead = reader.Read(buffer, 0, bufferSize);
            if (samplesRead == 0)
            {
                break;
            }
            for (var i = 0; i < samplesRead; i++)
            {
                allSamples.Add(buffer[i]);
            }
        }

        return allSamples.ToArray();
    }

    private static IReadOnlyList<SignalChannel> BuildChannels(
        float[] interleavedSamples,
        int channelCount,
        int sampleRate,
        long totalFrames
    )
    {
        var channels = new SignalChannel[channelCount];

        for (var channelIndex = 0; channelIndex < channelCount; channelIndex++)
        {
            var channelSamples = ExtractChannelSamples(
                interleavedSamples,
                channelIndex,
                channelCount,
                totalFrames
            );

            channels[channelIndex] = new SignalChannel
            {
                Id = $"ch{channelIndex + 1}",
                Name = ResolveChannelName(channelIndex, channelCount),
                SampleRate = sampleRate,
                SampleCount = totalFrames,
                // Default convention: 1 FS = 1 Pa (peak).
                // 0 dBFS peak → 1 Pa peak → 1/√2 Pa RMS → 20×log10(0.7071/20e-6) ≈ 91 dB SPL.
                // IsUserAssumed = true because this is a convention, not a measured calibration.
                Quantity = "sound_pressure",
                Unit = "Pa",
                DbReference = new DbReference
                {
                    Value = AcousticPressureConverter.PressureReferencePa,
                    Unit = "Pa",
                    DbUnit = "dB re 20 µPa",
                },
                Calibration = new CalibrationInfo
                {
                    IsCalibrated = false,
                    Scale = 1.0,
                    Offset = 0.0,
                },
                PhysicalMetadata = new SignalPhysicalMetadata
                {
                    UnitKind = SignalUnitKind.PressurePascal,
                    Calibration = new AcousticCalibration
                    {
                        PascalsPerFullScale = 1.0,
                        IsUserAssumed = true,
                        Source = "Default: 1 FS = 1 Pa (peak). 0 dBFS ≈ 91 dB SPL.",
                    },
                },
                Samples = channelSamples,
            };
        }

        return channels;
    }

    private static float[] ExtractChannelSamples(
        float[] interleavedSamples,
        int channelIndex,
        int channelCount,
        long totalFrames
    )
    {
        var channelSamples = new float[totalFrames];

        for (var frameIndex = 0; frameIndex < totalFrames; frameIndex++)
        {
            var interleavedIndex = frameIndex * channelCount + channelIndex;
            if (interleavedIndex < interleavedSamples.Length)
            {
                channelSamples[frameIndex] = interleavedSamples[interleavedIndex];
            }
        }

        return channelSamples;
    }

    private static string ResolveChannelName(int channelIndex, int totalChannels)
    {
        if (totalChannels == 1)
            return "Mono";
        if (totalChannels == 2)
            return channelIndex == 0 ? "Left" : "Right";
        return $"Channel {channelIndex + 1}";
    }

    private static string ResolveEncodingFormat(WaveFormatEncoding encoding)
    {
        return encoding switch
        {
            WaveFormatEncoding.Pcm => "PCM",
            WaveFormatEncoding.IeeeFloat => "IEEE_FLOAT",
            WaveFormatEncoding.Extensible => "EXTENSIBLE",
            WaveFormatEncoding.ALaw => "ALAW",
            WaveFormatEncoding.MuLaw => "ULAW",
            _ => "UNKNOWN",
        };
    }
}
