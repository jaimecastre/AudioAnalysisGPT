using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class GenerateReportEndpoint(ToolExecutionService toolExecutionService)
    : Endpoint<GenerateReportRequest, GenerateReportResponse>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public override void Configure()
    {
        Post("/api/analysis/report");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        GenerateReportRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.FileIds is null || request.FileIds.Count == 0)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync("fileIds is required.", cancellationToken);
            return;
        }

        var arguments = new Dictionary<string, object?>
        {
            ["fileIds"] = request.FileIds,
            ["title"] = request.Title ?? "Acoustic QA Report",
        };
        if (request.StartSeconds.HasValue) arguments["startSeconds"] = request.StartSeconds.Value;
        if (request.EndSeconds.HasValue) arguments["endSeconds"] = request.EndSeconds.Value;

        var toolRequest = new PlannerToolRequest
        {
            Name = AgentToolNames.GenerateReport,
            Arguments = arguments,
        };

        var output = await toolExecutionService.ExecuteToolAsync(toolRequest, cancellationToken);

        if (output.Status != "completed" || output.ResultData is null)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                output.ErrorMessage ?? "Report generation failed.",
                cancellationToken
            );
            return;
        }

        var json = JsonSerializer.Serialize(output.ResultData);
        var parsed = JsonSerializer.Deserialize<ReportResultData>(json, JsonOptions);

        if (parsed is null || string.IsNullOrWhiteSpace(parsed.MarkdownContent))
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync("Report data was empty.", cancellationToken);
            return;
        }

        Response = new GenerateReportResponse
        {
            Title = parsed.Title,
            MarkdownContent = parsed.MarkdownContent,
            GeneratedAtUtc = parsed.GeneratedAtUtc,
        };
    }
}

public class GenerateReportRequest
{
    public List<string>? FileIds { get; set; }
    public string? Title { get; set; }
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
}

public class GenerateReportResponse
{
    public string Title { get; set; } = string.Empty;
    public string MarkdownContent { get; set; } = string.Empty;
    public DateTimeOffset GeneratedAtUtc { get; set; }
}

file sealed class ReportResultData
{
    public string Title { get; set; } = string.Empty;
    public string MarkdownContent { get; set; } = string.Empty;
    public DateTimeOffset GeneratedAtUtc { get; set; }
}
