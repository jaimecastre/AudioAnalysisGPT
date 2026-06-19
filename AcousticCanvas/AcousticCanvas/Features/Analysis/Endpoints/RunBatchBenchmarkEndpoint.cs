using System.Text.Json;
using System.Text.Json.Serialization;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Handlers;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http.Features;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunBatchBenchmarkEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunBatchBenchmarkRequest>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public override void Configure()
    {
        Post("/api/analysis/batch-benchmark");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunBatchBenchmarkRequest request,
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

        HttpContext.Response.ContentType = "application/x-ndjson";
        HttpContext.Response.Headers.CacheControl = "no-cache";
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            var fileCount = request.FileIds.Count;

            var compareTask = new RunCompareCommand(
                FilePaths: filePaths,
                StartSeconds: request.StartSeconds,
                EndSeconds: request.EndSeconds
            ).ExecuteAsync(cancellationToken);

            var findingsTasks = filePaths
                .Select(
                    (path, i) =>
                        (
                            Index: i,
                            Task: new RunFindingsCommand(FilePath: path).ExecuteAsync(
                                cancellationToken
                            )
                        )
                )
                .ToList();

            var findingsResults = new FindingsResult[fileCount];
            var pending = findingsTasks.ToList();
            var completedCount = 0;

            while (pending.Count > 0)
            {
                var doneTasks = pending.Select(p => (Task)p.Task).ToArray();
                var doneTask = await Task.WhenAny(doneTasks);

                var entry = pending.First(p => (Task)p.Task == doneTask);
                pending.Remove(entry);

                findingsResults[entry.Index] = await entry.Task;
                completedCount++;

                var fileName = Path.GetFileNameWithoutExtension(filePaths[entry.Index]);
                await WriteLineAsync(
                    new
                    {
                        type = "progress",
                        completed = completedCount,
                        total = fileCount,
                        fileName,
                    },
                    cancellationToken
                );
            }

            var compareResult = await compareTask;
            var sources = filePaths
                .Select(
                    (_, index) =>
                        new BatchBenchmarkSource(
                            compareResult.Files[index],
                            findingsResults[index].Findings,
                            request.FileIds[index]
                        )
                )
                .ToList();

            var benchmarkResult = BatchBenchmarkBuilder.Build(sources, DateTimeOffset.UtcNow);

            if (request.StartSeconds.HasValue || request.EndSeconds.HasValue)
            {
                var limitations = benchmarkResult.Limitations.ToList();
                limitations.Add(
                    "Level, spectrum, and sound-quality metrics use the selected region; findings counts are evaluated over full files in this version."
                );
                benchmarkResult = benchmarkResult with { Limitations = limitations };
            }

            await WriteLineAsync(
                new { type = "result", data = benchmarkResult },
                cancellationToken
            );
        }
        catch (Exception ex)
        {
            await WriteLineAsync(
                new
                {
                    type = "error",
                    message = $"Batch benchmark error: {ex.GetType().Name}: {ex.Message}",
                },
                cancellationToken
            );
        }
    }

    private async Task WriteLineAsync(object value, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(value, JsonOptions);
        await HttpContext.Response.WriteAsync(json + "\n", ct);
        await HttpContext.Response.Body.FlushAsync(ct);
    }
}

public class RunBatchBenchmarkRequest
{
    public List<string> FileIds { get; set; } = [];
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
}
