using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunAgentAnalysisEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunAgentAnalysisRequest, AgentAnalysisResult>
{
    public override void Configure()
    {
        Post("/api/analysis/run");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunAgentAnalysisRequest request,
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

        var allowedKinds = new[] { "file_info", "level", "spectrum" };
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

        var command = new RunAgentAnalysisCommand(
            Kind: request.Kind,
            FilePath: filePath,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds
        );

        Response = await command.ExecuteAsync(cancellationToken);
    }
}

public class RunAgentAnalysisRequest
{
    public string FileId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public double? StartSeconds { get; set; }
    public double? EndSeconds { get; set; }
}
