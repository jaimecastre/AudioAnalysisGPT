using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunCompareEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunCompareRequest, CompareResult>
{
    public override void Configure()
    {
        Post("/api/analysis/compare");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunCompareRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.FileIds == null || request.FileIds.Count < 2)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync(
                "At least two fileIds are required.",
                cancellationToken
            );
            return;
        }

        var filePaths = new List<string>();
        for (int index = 0; index < request.FileIds.Count; index++)
        {
            var filePath = audioFileRepository.GetFilePath(request.FileIds[index]);
            if (string.IsNullOrEmpty(filePath))
            {
                HttpContext.Response.StatusCode = 404;
                await HttpContext.Response.WriteAsync(
                    $"Audio file {index + 1} not found: {request.FileIds[index]}",
                    cancellationToken
                );
                return;
            }
            filePaths.Add(filePath);
        }

        var command = new RunCompareCommand(
            FilePaths: filePaths,
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
                $"Compare error: {ex.GetType().Name}: {ex.Message}",
                cancellationToken
            );
        }
    }
}

public class RunCompareRequest
{
    public List<string> FileIds { get; set; } = [];
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
}
