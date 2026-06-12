using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public sealed class RunSoundQualityEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunSoundQualityRequest, SoundQualityAnalysis>
{
    public override void Configure()
    {
        Post("/api/analysis/sound-quality");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunSoundQualityRequest request,
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

        var query = new RunSoundQualityQuery(
            FilePath: filePath,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds,
            Method: request.Method
        );

        try
        {
            Response = await query.ExecuteAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                $"Sound-quality analysis error: {ex.GetType().Name}: {ex.Message}",
                cancellationToken
            );
        }
    }
}

public sealed class RunSoundQualityRequest
{
    public string FileId { get; set; } = string.Empty;
    public double StartSeconds { get; set; }
    public double EndSeconds { get; set; }
    public string Method { get; set; } = "mosqito_stationary_zwicker";
}
