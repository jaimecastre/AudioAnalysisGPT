using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.AudioUpload.Services;
using FastEndpoints;
using MessagePack;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public class RunSpectrumEndpoint(AudioFileRepository audioFileRepository)
    : Endpoint<RunSpectrumRequest, SpectrumAnalysis>
{
    public override void Configure()
    {
        Post("/api/analysis/spectrum");
        AllowAnonymous();
    }

    public override async Task HandleAsync(
        RunSpectrumRequest request,
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

        var windowType = ParseWindowType(request.WindowType);

        var query = new RunSpectrumQuery(
            FilePath: filePath,
            StartSeconds: request.StartSeconds,
            EndSeconds: request.EndSeconds,
            FftSize: request.FftSize,
            Overlap: request.Overlap,
            WindowType: windowType
        );

        try
        {
            var result = await query.ExecuteAsync(cancellationToken);

            if (string.Equals(request.Format, "msgpack", StringComparison.OrdinalIgnoreCase))
            {
                var pointsResponse = SpectrumPointsMapper.ToPointsResponse(result);
                var bytes = MessagePackSerializer.Serialize(pointsResponse);
                HttpContext.Response.ContentType = "application/x-msgpack";
                HttpContext.Response.StatusCode = 200;
                await HttpContext.Response.Body.WriteAsync(bytes, cancellationToken);
                await HttpContext.Response.CompleteAsync();
                return;
            }

            Response = result;
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            await HttpContext.Response.WriteAsync(
                $"Spectrum analysis error: {ex.GetType().Name}: {ex.Message}",
                cancellationToken
            );
        }
    }

    private static SpectrumWindowType ParseWindowType(string windowType)
    {
        return windowType.Equals("rectangular", StringComparison.OrdinalIgnoreCase)
            ? SpectrumWindowType.Rectangular
            : SpectrumWindowType.Hann;
    }
}

public class RunSpectrumRequest
{
    public string FileId { get; set; } = string.Empty;
    public double StartSeconds { get; set; }
    public double EndSeconds { get; set; }
    public int FftSize { get; set; } = 8192;
    public double Overlap { get; set; } = 0.677;
    public string WindowType { get; set; } = "hann";
    public string Format { get; set; } = "json";
}
