using NAudio.Wave;
using AcousticCanvas.Features.Waveform.Models;

namespace AcousticCanvas.Features.Waveform.Services;

public class WaveformAnalyzer
{
    public WaveformResponse AnalyzeWav(string filePath, int targetPoints)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"Audio file not found: {filePath}");
        }

        using var reader = new AudioFileReader(filePath);

        var sampleRate = reader.WaveFormat.SampleRate;
        var channels = reader.WaveFormat.Channels;
        var durationSeconds = reader.TotalTime.TotalSeconds;
        var totalSamples = (long)(durationSeconds * sampleRate * channels);

        if (totalSamples == 0)
        {
            throw new InvalidOperationException("Audio file contains no samples.");
        }

        var samplesPerBucket = (int)Math.Max(1, totalSamples / targetPoints / channels);
        var readBuffer = new float[samplesPerBucket * channels];

        var peaksInterleaved = new List<float>(targetPoints * 2);
        var globalMinFs = float.MaxValue;
        var globalMaxFs = float.MinValue;

        while (true)
        {
            var samplesRead = reader.Read(readBuffer, 0, readBuffer.Length);
            if (samplesRead == 0)
            {
                break;
            }

            var bucketMinFs = float.MaxValue;
            var bucketMaxFs = float.MinValue;

            for (var sampleIndex = 0; sampleIndex < samplesRead; sampleIndex++)
            {
                var sample = readBuffer[sampleIndex];
                if (sample < bucketMinFs) bucketMinFs = sample;
                if (sample > bucketMaxFs) bucketMaxFs = sample;
            }

            if (bucketMinFs == float.MaxValue) bucketMinFs = 0f;
            if (bucketMaxFs == float.MinValue) bucketMaxFs = 0f;

            peaksInterleaved.Add(bucketMinFs);
            peaksInterleaved.Add(bucketMaxFs);

            if (bucketMinFs < globalMinFs) globalMinFs = bucketMinFs;
            if (bucketMaxFs > globalMaxFs) globalMaxFs = bucketMaxFs;
        }

        if (peaksInterleaved.Count == 0)
        {
            throw new InvalidOperationException("No waveform buckets could be extracted.");
        }

        if (globalMinFs == float.MaxValue) globalMinFs = 0f;
        if (globalMaxFs == float.MinValue) globalMaxFs = 0f;

        return new WaveformResponse
        {
            DurationSeconds = durationSeconds,
            SampleRate = sampleRate,
            Channels = channels,
            GlobalMinFs = Math.Round(globalMinFs, 6),
            GlobalMaxFs = Math.Round(globalMaxFs, 6),
            Peaks = peaksInterleaved.ToArray(),
        };
    }
}
