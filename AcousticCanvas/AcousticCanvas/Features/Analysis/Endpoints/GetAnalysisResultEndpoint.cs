using AcousticCanvas.Features.Analysis.Services;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class GetAnalysisResultEndpoint(AnalysisResultCache resultCache)
    : Endpoint<GetAnalysisResultRequest, object>
{
    public override void Configure()
    {
        Get("/api/analysis/results/{resultId}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        GetAnalysisResultRequest request,
        CancellationToken cancellationToken
    )
    {
        Console.WriteLine($"[GetAnalysisResultEndpoint] Requested resultId: {request.ResultId}");
        var cachedResult = resultCache.GetResult(request.ResultId);

        if (cachedResult == null)
        {
            Console.WriteLine($"[GetAnalysisResultEndpoint] Result NOT FOUND: {request.ResultId}");
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsJsonAsync(
                new { error = "Analysis result not found or expired" },
                cancellationToken
            );
            return;
        }
        Console.WriteLine($"[GetAnalysisResultEndpoint] Found result: {request.ResultId} of type {cachedResult.Type}");

        // Wrap in a type envelope for frontend discrimination
        var response = new AnalysisResultResponse
        {
            Type = cachedResult.Type,
            Data = cachedResult.Data,
        };

        await HttpContext.Response.WriteAsJsonAsync(response, cancellationToken);
    }
}

public class GetAnalysisResultRequest
{
    [FastEndpoints.BindFrom("resultId")]
    public string ResultId { get; set; } = string.Empty;
}

public class AnalysisResultResponse
{
    public string Type { get; set; } = string.Empty;
    public object Data { get; set; } = new();
}
