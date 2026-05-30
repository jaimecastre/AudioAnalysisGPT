using FastEndpoints;
using AcousticCanvas.Features.AudioUpload.Commands;
using AcousticCanvas.Features.AudioUpload.Handlers;

namespace AcousticCanvas.Features.AudioUpload.Endpoints;

public class UploadAudioEndpoint(UploadAudioHandler handler)
    : Endpoint<UploadAudioRequest, UploadAudioResult>
{
    public override void Configure()
    {
        Post("/api/audio/upload");
        AllowAnonymous();
        AllowFileUploads();
    }

    public override async Task HandleAsync(UploadAudioRequest request, CancellationToken cancellationToken)
    {
        if (request.File is not { Length: > 0 })
        {
            ThrowError("No audio file provided");
            return;
        }

        await using var fileStream = request.File.OpenReadStream();

        var result = await handler.ExecuteAsync(
            new UploadAudioCommand(fileStream, request.File.FileName),
            cancellationToken);

        Response = result;
    }
}

public class UploadAudioRequest
{
    public IFormFile File { get; set; } = null!;
}
