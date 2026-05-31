using FastEndpoints;

namespace AcousticCanvas.Features.AudioUpload.Commands;

public record UploadAudioCommand(Stream FileStream, string FileName) : ICommand<UploadAudioResult>;

public record UploadAudioResult(
    string Id,
    string Name,
    double DurationSeconds,
    int SampleRate,
    int Channels,
    int BitDepth
);
