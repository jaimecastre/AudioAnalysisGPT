using AcousticCanvas.Features.AudioUpload.Handlers;
using FastEndpoints;

namespace AcousticCanvas.Features.Playback.Endpoints;

public class ServeAudioFileEndpoint(UploadAudioHandler audioHandler)
    : Endpoint<ServeAudioFileRequest>
{
    public override void Configure()
    {
        Get("/api/audio/file/{fileid}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ServeAudioFileRequest request, CancellationToken cancellationToken)
    {
        var filePath = audioHandler.GetFilePath(request.FileId);

        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
        {
            var storagePath = Path.Combine(Directory.GetCurrentDirectory(), "AudioStorage");
            var files = Directory.Exists(storagePath)
                ? string.Join(", ", Directory.GetFiles(storagePath).Select(Path.GetFileName))
                : "N/A";
            var debugInfo = $"FileId: {request.FileId}, ResolvedPath: '{filePath}', StoragePath: '{storagePath}', Files: [{files}]";
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync($"Audio file not found. {debugInfo}", cancellationToken);
            return;
        }

        var fileName = Path.GetFileName(filePath);
        var fileInfo = new FileInfo(filePath);

        HttpContext.Response.ContentType = "audio/wav";
        HttpContext.Response.Headers.Append("Content-Disposition", $"inline; filename=\"{fileName}\"");
        HttpContext.Response.ContentLength = fileInfo.Length;
        HttpContext.Response.Headers.Append("Accept-Ranges", "bytes");

        await using var fileStream = File.OpenRead(filePath);
        await fileStream.CopyToAsync(HttpContext.Response.Body, cancellationToken);
    }
}

public class ServeAudioFileRequest
{
    public string FileId { get; set; } = string.Empty;
}
