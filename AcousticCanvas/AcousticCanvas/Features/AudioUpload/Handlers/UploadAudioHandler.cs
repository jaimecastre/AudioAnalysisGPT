using FastEndpoints;
using NAudio.Wave;
using AcousticCanvas.Features.AudioUpload.Commands;

namespace AcousticCanvas.Features.AudioUpload.Handlers;

public class UploadAudioHandler : CommandHandler<UploadAudioCommand, UploadAudioResult>
{
    private const int WaveformResolution = 2000;
    private readonly string _storagePath;

    public UploadAudioHandler()
    {
        _storagePath = Path.Combine(Directory.GetCurrentDirectory(), "AudioStorage");
        Directory.CreateDirectory(_storagePath);
    }

    public override Task<UploadAudioResult> ExecuteAsync(UploadAudioCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var fileId = Guid.NewGuid().ToString("N")[..12];
        var storedFileName = $"{fileId}_{command.FileName}";
        var storagePath = Path.Combine(_storagePath, storedFileName);

        using (var fileOutput = File.Create(storagePath))
        {
            command.FileStream.CopyTo(fileOutput);
        }

        var result = ProcessAudioFile(storagePath, fileId, command.FileName);
        return Task.FromResult(result);
    }

    public string GetFilePath(string fileId)
    {
        var files = Directory.GetFiles(_storagePath, $"{fileId}_*");
        return files.FirstOrDefault() ?? string.Empty;
    }

    private static UploadAudioResult ProcessAudioFile(
        string filePath,
        string fileId,
        string fileName)
    {
        using var reader = new AudioFileReader(filePath);

        var sampleRate = reader.WaveFormat.SampleRate;
        var channels = reader.WaveFormat.Channels;
        var durationSeconds = reader.TotalTime.TotalSeconds;
        var bitDepth = reader.WaveFormat.BitsPerSample;

        List<WaveformDataPoint> waveformData;
        try
        {
            waveformData = ExtractWaveformData(reader);
        }
        catch
        {
            waveformData = new List<WaveformDataPoint>();
        }

        return new UploadAudioResult(
            fileId,
            fileName,
            durationSeconds,
            sampleRate,
            channels,
            bitDepth,
            waveformData
        );
    }

    private static List<WaveformDataPoint> ExtractWaveformData(AudioFileReader reader)
    {
        var waveformData = new List<WaveformDataPoint>();
        var sampleRate = reader.WaveFormat.SampleRate;
        var totalTime = reader.TotalTime.TotalSeconds;
        var samplesPerPoint = (int)(sampleRate * totalTime / WaveformResolution);
        var channels = reader.WaveFormat.Channels;

        if (samplesPerPoint < channels)
        {
            samplesPerPoint = channels;
        }

        // Ensure buffer size is multiple of channels to maintain block alignment
        samplesPerPoint = (samplesPerPoint / channels) * channels;

        var buffer = new float[samplesPerPoint];
        var samplesReadTotal = 0;
        var sampleRateDouble = (double)sampleRate;

        reader.Position = 0;

        while (true)
        {
            int samplesToRead = buffer.Length;
            int samplesRead;

            try
            {
                samplesRead = reader.Read(buffer, 0, samplesToRead);
            }
            catch (ArgumentException)
            {
                // Block alignment error - try reading smaller chunk
                samplesToRead = channels * 1024;
                if (samplesToRead > buffer.Length)
                {
                    samplesToRead = buffer.Length;
                }
                samplesRead = reader.Read(buffer, 0, samplesToRead);
            }

            if (samplesRead == 0)
            {
                break;
            }

            var minAmplitude = float.MaxValue;
            var maxAmplitude = float.MinValue;

            for (var index = 0; index < samplesRead; index++)
            {
                var sample = buffer[index];
                if (sample < minAmplitude)
                {
                    minAmplitude = sample;
                }
                if (sample > maxAmplitude)
                {
                    maxAmplitude = sample;
                }
            }

            var timePosition = samplesReadTotal / sampleRateDouble;

            waveformData.Add(new WaveformDataPoint(
                timePosition,
                minAmplitude == float.MaxValue ? 0 : minAmplitude,
                maxAmplitude == float.MinValue ? 0 : maxAmplitude
            ));

            samplesReadTotal += samplesRead;
        }

        return waveformData;
    }
}
