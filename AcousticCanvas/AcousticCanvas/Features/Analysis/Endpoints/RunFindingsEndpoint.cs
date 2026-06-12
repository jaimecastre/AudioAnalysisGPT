using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunFindingsEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunFindingsRequest, FindingsResult>
{
    public override void Configure()
    {
        Post("/api/analysis/findings");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunFindingsRequest request,
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

        var command = new RunFindingsCommand(FilePath: filePath);

        try
        {
            Response = await command.ExecuteAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                $"Findings error: {ex.GetType().Name}: {ex.Message}",
                cancellationToken
            );
        }
    }
}

public class RunFindingsRequest
{
    public string FileId { get; set; } = string.Empty;
}
