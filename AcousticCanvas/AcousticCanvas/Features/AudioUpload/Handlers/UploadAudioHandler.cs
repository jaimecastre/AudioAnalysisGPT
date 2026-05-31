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

        var result = ReadAudioMetadata(storagePath, fileId, command.FileName);
        return Task.FromResult(result);
    }

    public string GetFilePath(string fileId)
    {
        var files = Directory.GetFiles(_storagePath, $"{fileId}_*");
        return files.FirstOrDefault() ?? string.Empty;
    }

    private static UploadAudioResult ReadAudioMetadata(string filePath, string fileId, string fileName)
    {
        using var reader = new AudioFileReader(filePath);

        return new UploadAudioResult(
            fileId,
            fileName,
            reader.TotalTime.TotalSeconds,
            reader.WaveFormat.SampleRate,
            reader.WaveFormat.Channels,
            reader.WaveFormat.BitsPerSample
        );
    }
}
