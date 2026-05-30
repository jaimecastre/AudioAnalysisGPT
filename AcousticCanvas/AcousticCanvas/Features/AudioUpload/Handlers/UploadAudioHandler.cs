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

        var waveformData = ExtractWaveformData(reader);

        return new UploadAudioResult(
            fileId,
            fileName,
            durationSeconds,
            sampleRate,
            channels,
            32,
            waveformData
        );
    }

    private static List<WaveformDataPoint> ExtractWaveformData(AudioFileReader reader)
    {
        var waveformData = new List<WaveformDataPoint>();
        var totalSamples = (long)(reader.Length / sizeof(float));
        var samplesPerPoint = totalSamples / WaveformResolution;

        if (samplesPerPoint < 1)
        {
            samplesPerPoint = 1;
        }

        var buffer = new float[samplesPerPoint];
        var samplePosition = 0;
        var timePosition = 0.0;
        var sampleRate = reader.WaveFormat.SampleRate;
        var samplesReadTotal = 0;

        reader.Position = 0;

        while (samplesReadTotal < totalSamples)
        {
            var samplesToRead = (int)Math.Min(buffer.Length, totalSamples - samplesReadTotal);
            var samplesRead = reader.Read(buffer, 0, samplesToRead);

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

            if (samplesRead > 0)
            {
                waveformData.Add(new WaveformDataPoint(
                    timePosition,
                    minAmplitude == float.MaxValue ? 0 : minAmplitude,
                    maxAmplitude == float.MinValue ? 0 : maxAmplitude
                ));
            }

            samplesReadTotal += samplesRead;
            samplePosition += samplesRead;
            timePosition = samplePosition / sampleRate;
        }

        return waveformData;
    }
}
