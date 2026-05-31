using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Handlers;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunSpectrogramEndpoint(UploadAudioHandler uploadAudioHandler)
    : Endpoint<RunSpectrogramRequest, SpectrogramAnalysis>
{
    public override void Configure()
    {
        Post("/api/analysis/spectrogram");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RunSpectrogramRequest request, CancellationToken cancellationToken)
    {
        var filePath = uploadAudioHandler.GetFilePath(request.FileId);
        if (string.IsNullOrEmpty(filePath))
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Audio file not found.", cancellationToken);
            return;
        }

        var query = new RunSpectrogramQuery(
            FilePath: filePath,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds,
            FftSize: request.FftSize,
            Overlap: request.Overlap);

        try
        {
            Response = await query.ExecuteAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync($"Spectrogram analysis error: {ex.GetType().Name}: {ex.Message}", cancellationToken);
        }
    }
}

public class RunSpectrogramRequest
{
    public string FileId { get; set; } = string.Empty;
    public double StartSeconds { get; set; }
    public double EndSeconds { get; set; }
    public int FftSize { get; set; } = 2048;
    public double Overlap { get; set; } = 0.75;
}
