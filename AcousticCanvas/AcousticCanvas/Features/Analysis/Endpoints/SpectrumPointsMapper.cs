using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public static class SpectrumPointsMapper
{
    public static SpectrumPointsResponse ToPointsResponse(SpectrumAnalysis analysis)
    {
        var channelPoints = new List<SpectrumChannelPoints>(analysis.Channels.Count);

        foreach (var channel in analysis.Channels)
        {
            if (channel.FrequenciesHz.Count == 0)
            {
                continue;
            }

            var points = new double[channel.FrequenciesHz.Count][];
            var hasDb = channel.MagnitudesDb.Count > 0 && channel.MagnitudesDb[0].HasValue;

            for (var i = 0; i < channel.FrequenciesHz.Count; i++)
            {
                var frequencyHz = channel.FrequenciesHz[i];
                var yValue = hasDb && channel.MagnitudesDb[i].HasValue
                    ? channel.MagnitudesDb[i]!.Value
                    : channel.Magnitudes[i];
                points[i] = new[] { frequencyHz, yValue };
            }

            channelPoints.Add(
                new SpectrumChannelPoints
                {
                    ChannelId = channel.ChannelId,
                    ChannelName = channel.ChannelName,
                    Points = points,
                    YUnit = channel.DbUnit ?? channel.Unit,
                    YAxisLabel = channel.YAxisLabel ?? string.Empty,
                    CalibrationState = channel.CalibrationState ?? string.Empty,
                    MaxMagnitudeDb = channel.MaxMagnitudeDb,
                    PeakFrequencyHz = channel.PeakFrequencyHz,
                    DbReferenceValue = channel.DbReferenceValue,
                    DbReferenceUnit = channel.DbReferenceUnit,
                    PhysicalQuantity = channel.PhysicalQuantity,
                    TonalPeaks = channel.TonalPeaks,
                }
            );
        }

        return new SpectrumPointsResponse
        {
            Parameters = new SpectrumPointsParameters
            {
                FftSize = analysis.Parameters.FftSize,
                WindowType = analysis.Parameters.WindowType,
                Overlap = analysis.Parameters.Overlap,
                Averaging = analysis.Parameters.Averaging,
                Scaling = analysis.Parameters.Scaling,
                StartTimeSeconds = analysis.Parameters.StartTimeSeconds,
                EndTimeSeconds = analysis.Parameters.EndTimeSeconds,
                BlockCount = analysis.Parameters.BlockCount,
            },
            Region = new SpectrumPointsRegion
            {
                StartSeconds = analysis.Region.StartSeconds,
                EndSeconds = analysis.Region.EndSeconds,
                DurationSeconds = analysis.Region.DurationSeconds,
            },
            Channels = channelPoints,
        };
    }
}
