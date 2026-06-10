using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.AudioUpload.Handlers;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunBatchBenchmarkEndpoint(UploadAudioHandler uploadAudioHandler)
    : Endpoint<RunBatchBenchmarkRequest, BatchBenchmarkResult>
{
    public override void Configure()
    {
        Post("/api/analysis/batch-benchmark");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RunBatchBenchmarkRequest request, CancellationToken cancellationToken)
    {
        if (request.FileIds == null || request.FileIds.Count < 2)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync("At least two fileIds are required.", cancellationToken);
            return;
        }

        var filePaths = new List<string>();
        for (int index = 0; index < request.FileIds.Count; index++)
        {
            var filePath = uploadAudioHandler.GetFilePath(request.FileIds[index]);
            if (string.IsNullOrEmpty(filePath))
            {
                HttpContext.Response.StatusCode = 404;
                await HttpContext.Response.WriteAsync($"Audio file {index + 1} not found: {request.FileIds[index]}", cancellationToken);
                return;
            }

            filePaths.Add(filePath);
        }

        var command = new RunBatchBenchmarkCommand(
            FileIds: request.FileIds,
            FilePaths: filePaths,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds,
            IncludeSoundQuality: request.IncludeSoundQuality ?? true);

        try
        {
            Response = await command.ExecuteAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync($"Batch benchmark error: {ex.GetType().Name}: {ex.Message}", cancellationToken);
        }
    }
}

public class RunBatchBenchmarkRequest
{
    public List<string> FileIds { get; set; } = [];
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
    public bool? IncludeSoundQuality { get; set; }
}
