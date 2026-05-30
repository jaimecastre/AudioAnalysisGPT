using FastEndpoints;

namespace AcousticCanvas.Features.AudioUpload.Commands;

public record UploadAudioCommand(Stream FileStream, string FileName, int Resolution = 2000) : ICommand<UploadAudioResult>;

public record UploadAudioResult(
    string Id,
    string Name,
    double DurationSeconds,
    int SampleRate,
    int Channels,
    int BitDepth,
    List<WaveformBin> WaveformBins
);

public record WaveformBin(
    double X,
    double YMin,
    double YMax
);
