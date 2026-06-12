using AcousticCanvas.Features.AudioUpload.Commands;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;
using NAudio.Wave;

namespace AcousticCanvas.Features.AudioUpload.Handlers;

public class UploadAudioHandler(AudioFileRepository audioFileRepository)
    : CommandHandler<UploadAudioCommand, UploadAudioResult>
{
    public override Task<UploadAudioResult> ExecuteAsync(
        UploadAudioCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        var fileId = Guid.NewGuid().ToString("N")[..12];
        var storagePath = audioFileRepository.SaveFile(
            fileId,
            command.FileName,
            command.FileStream
        );

        var result = ReadAudioMetadata(storagePath, fileId, command.FileName);
        return Task.FromResult(result);
    }

    private static UploadAudioResult ReadAudioMetadata(
        string filePath,
        string fileId,
        string fileName
    )
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
