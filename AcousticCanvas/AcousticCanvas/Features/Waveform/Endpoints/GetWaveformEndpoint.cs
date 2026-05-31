using FastEndpoints;
using AcousticCanvas.Features.AudioUpload.Handlers;
using AcousticCanvas.Features.Waveform.Models;
using AcousticCanvas.Features.Waveform.Services;

namespace AcousticCanvas.Features.Waveform.Endpoints;

public class GetWaveformEndpoint(UploadAudioHandler uploadAudioHandler, WaveformAnalyzer waveformAnalyzer)
    : Endpoint<GetWaveformRequest, WaveformResponse>
{
    public override void Configure()
    {
        Get("/api/waveform");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetWaveformRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FileId))
        {
            ThrowError("fileId is required");
            return;
        }

        var resolvedPoints = request.Points is > 0 ? request.Points.Value : 1000;

        var filePath = uploadAudioHandler.GetFilePath(request.FileId);
        if (string.IsNullOrEmpty(filePath))
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Audio file not found.", cancellationToken);
            return;
        }

        try
        {
            var waveformResponse = waveformAnalyzer.AnalyzeWav(filePath, resolvedPoints);
            Response = waveformResponse;
        }
        catch (Exception ex)
        {
            ThrowError($"Failed to analyze waveform: {ex.Message}");
        }
    }
}

public class GetWaveformRequest
{
    public string FileId { get; set; } = string.Empty;
    public int? Points { get; set; }
}
