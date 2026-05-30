using FastEndpoints;
using NAudio.Wave;
using AcousticCanvas.Features.AudioUpload.Commands;

namespace AcousticCanvas.Features.AudioUpload.Handlers;

public class UploadAudioHandler : CommandHandler<UploadAudioCommand, UploadAudioResult>
{
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

        var result = ProcessAudioFile(storagePath, fileId, command.FileName, command.Resolution);
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
        string fileName,
        int resolution)
    {
        using var reader = new AudioFileReader(filePath);

        var sampleRate = reader.WaveFormat.SampleRate;
        var channels = reader.WaveFormat.Channels;
        var durationSeconds = reader.TotalTime.TotalSeconds;
        var bitDepth = reader.WaveFormat.BitsPerSample;

        List<WaveformBin> waveformBins;
        try
        {
            waveformBins = ExtractWaveformBins(reader, resolution);
        }
        catch
        {
            waveformBins = new List<WaveformBin>();
        }

        return new UploadAudioResult(
            fileId,
            fileName,
            durationSeconds,
            sampleRate,
            channels,
            bitDepth,
            waveformBins
        );
    }

    private static List<WaveformBin> ExtractWaveformBins(AudioFileReader reader, int resolution)
    {
        var bins = new List<WaveformBin>();
        var sampleRate = reader.WaveFormat.SampleRate;
        var channels = reader.WaveFormat.Channels;
        var durationSeconds = reader.TotalTime.TotalSeconds;
        
        // Calculate samples per bin based on resolution requested
        var totalSamples = (long)(sampleRate * durationSeconds * channels);
        var samplesPerBin = (int)(totalSamples / resolution);
        
        if (samplesPerBin < channels)
        {
            samplesPerBin = channels;
        }
        
        // Ensure block alignment
        samplesPerBin = (samplesPerBin / channels) * channels;

        var buffer = new float[samplesPerBin];
        var samplesReadTotal = 0;
        var binIndex = 0;
        
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

            // Sum to mono for analysis
            for (var index = 0; index < samplesRead; index += channels)
            {
                float sampleSum = 0;
                for (var ch = 0; ch < channels; ch++)
                {
                    sampleSum += buffer[index + ch];
                }
                var monoSample = sampleSum / channels;
                
                if (monoSample < minAmplitude)
                {
                    minAmplitude = monoSample;
                }
                if (monoSample > maxAmplitude)
                {
                    maxAmplitude = monoSample;
                }
            }

            // X is normalized position (0 to 1)
            var x = (double)binIndex / resolution;
            
            bins.Add(new WaveformBin(
                x,
                minAmplitude == float.MaxValue ? 0 : minAmplitude,
                maxAmplitude == float.MinValue ? 0 : maxAmplitude
            ));

            samplesReadTotal += samplesRead;
            binIndex++;
        }

        return bins;
    }
}
