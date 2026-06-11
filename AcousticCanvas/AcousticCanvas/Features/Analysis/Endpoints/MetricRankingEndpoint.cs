using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Handlers;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class MetricRankingEndpoint(MetricRankingHandler handler)
    : Endpoint<MetricRankingRequest, MetricRankingResult>
{
    public override void Configure()
    {
        Post("/api/analysis/metric-ranking");
        AllowAnonymous();
    }

    public override async Task HandleAsync(MetricRankingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            Response = await handler.ExecuteAsync(request, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsync($"Invalid request: {ex.Message}", cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync($"Metric ranking error: {ex.GetType().Name}: {ex.Message}", cancellationToken);
        }
    }
}

public class MetricRankingApiRequest
{
    public IReadOnlyList<string> FileIds { get; set; } = [];
    public IReadOnlyList<string> Metrics { get; set; } = [];
}
