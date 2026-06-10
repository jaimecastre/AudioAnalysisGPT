using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunAnalysisEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunAnalysisRequest, AnalysisResult>
{
    public override void Configure()
    {
        Get("/api/analysis");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RunAnalysisRequest request, CancellationToken cancellationToken)
    {
        var filePath = audioFileRepository.GetFilePath(request.FileId);
        if (string.IsNullOrEmpty(filePath))
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Audio file not found.", cancellationToken);
            return;
        }

        var query = new RunAnalysisQuery(FilePath: filePath);
        Response = await query.ExecuteAsync(cancellationToken);
    }
}

public class RunAnalysisRequest
{
    public string FileId { get; set; } = string.Empty;
}
