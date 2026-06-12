using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunFindEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunFindRequest, FindEventsResult>
{
    public override void Configure()
    {
        Post("/api/analysis/find");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunFindRequest request,
        CancellationToken cancellationToken
    )
    {
        var filePath = audioFileRepository.GetFilePath(request.FileId);
        if (string.IsNullOrEmpty(filePath))
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Audio file not found.", cancellationToken);
            return;
        }

        var allowedKinds = new[] { "clipping", "silence", "loudest", "transient" };
        var kindIsValid = Array.Exists(allowedKinds, k => k == request.Kind);
        if (!kindIsValid)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync(
                $"Kind must be one of: {string.Join(", ", allowedKinds)}",
                cancellationToken
            );
            return;
        }

        var command = new FindEventsCommand(
            Kind: request.Kind,
            FilePath: filePath,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds
        );

        try
        {
            Response = await command.ExecuteAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                $"Find error: {ex.GetType().Name}: {ex.Message}",
                cancellationToken
            );
        }
    }
}

public class RunFindRequest
{
    public string FileId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
}
