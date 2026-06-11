using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Handlers;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class SoundQualitySummaryEndpoint(SoundQualitySummaryHandler handler)
    : Endpoint<SoundQualitySummaryRequest, SoundQualitySummaryResult>
{
    public override void Configure()
    {
        Post("/api/analysis/sound-quality-summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SoundQualitySummaryRequest request, CancellationToken cancellationToken)
    {
        try
        {
            Response = await handler.ExecuteAsync(request, cancellationToken);
        }
        catch (FileNotFoundException ex)
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync($"File not found: {ex.Message}", cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync($"Sound quality summary error: {ex.GetType().Name}: {ex.Message}", cancellationToken);
        }
    }
}

public class SoundQualitySummaryApiRequest
{
    public string FileId { get; set; } = string.Empty;
}
