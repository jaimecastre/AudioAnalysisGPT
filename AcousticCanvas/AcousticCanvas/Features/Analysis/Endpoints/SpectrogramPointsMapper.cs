using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Endpoints;

public static class SpectrogramPointsMapper
{
    public static SpectrogramPointsResponse ToPointsResponse(SpectrogramAnalysis analysis)
    {
        var channelPoints = new List<SpectrogramChannelPoints>(analysis.Channels.Count);

        foreach (var channel in analysis.Channels)
        {
            if (channel.FrequencyData.Count == 0)
            {
                continue;
            }

            var frameCount = channel.FrameCount;
            var binCount = channel.BinCount;
            var points = new List<double[]>(frameCount * binCount);

            var startSeconds = analysis.Parameters.StartTimeSeconds;
            var endSeconds = analysis.Parameters.EndTimeSeconds;
            var durationSeconds = endSeconds - startSeconds;
            var nyquistHz = channel.NyquistHz;

            // Calculate time per frame
            var timePerFrame = durationSeconds / Math.Max(1, frameCount - 1);

            // Calculate frequency per bin
            var frequencyPerBin = nyquistHz / Math.Max(1, binCount - 1);

            // Determine if this is pressure-calibrated data
            var isPressureCalibrated =
                channel.CalibrationState == "pressure_signal"
                || channel.CalibrationState == "calibrated";

            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++)
            {
                var timeSeconds = startSeconds + frameIndex * timePerFrame;
                var frameData = channel.FrequencyData[frameIndex];

                for (var binIndex = 0; binIndex < binCount; binIndex++)
                {
                    var frequencyHz = binIndex * frequencyPerBin;
                    var byteValue = frameData[binIndex];

                    double magnitudeDb;

                    if (isPressureCalibrated)
                    {
                        // Reverse the byte-to-dB mapping for pressure data
                        magnitudeDb = AcousticPressureConverter.MapByteToDbSpl(
                            byteValue,
                            analysis.Parameters.MinDbSpl,
                            analysis.Parameters.MaxDbSpl
                        );
                    }
                    else
                    {
                        // For relative dB data, we can't perfectly reverse the byte mapping
                        // because we don't have the global max amplitude.
                        // Approximate by assuming the byte value represents a normalized level.
                        // This is a limitation of the current byte encoding.
                        var normalizedLevel = byteValue / 255.0;
                        var gainDb = analysis.Parameters.GainDb;
                        var rangeDb = analysis.Parameters.RangeDb;
                        var floorDb = -(gainDb + rangeDb);
                        magnitudeDb = floorDb + normalizedLevel * (gainDb - floorDb);
                    }

                    points.Add(new[] { timeSeconds, frequencyHz, magnitudeDb });
                }
            }

            channelPoints.Add(
                new SpectrogramChannelPoints
                {
                    ChannelId = channel.ChannelId,
                    ChannelName = channel.ChannelName,
                    Points = points.ToArray(),
                    BinCount = channel.BinCount,
                    FrameCount = channel.FrameCount,
                    NyquistHz = channel.NyquistHz,
                    ColorbandLabel = channel.ColorbandLabel,
                    CalibrationState = channel.CalibrationState,
                }
            );
        }

        return new SpectrogramPointsResponse
        {
            Parameters = new SpectrogramPointsParameters
            {
                FftSize = analysis.Parameters.FftSize,
                WindowType = analysis.Parameters.WindowType,
                Overlap = analysis.Parameters.Overlap,
                Scale = analysis.Parameters.Scale,
                GainDb = analysis.Parameters.GainDb,
                RangeDb = analysis.Parameters.RangeDb,
                StartTimeSeconds = analysis.Parameters.StartTimeSeconds,
                EndTimeSeconds = analysis.Parameters.EndTimeSeconds,
                FrameCount = analysis.Parameters.FrameCount,
                BinCount = analysis.Parameters.BinCount,
                SampleRate = analysis.Parameters.SampleRate,
                MinDbSpl = analysis.Parameters.MinDbSpl,
                MaxDbSpl = analysis.Parameters.MaxDbSpl,
            },
            Region = new SpectrogramPointsRegion
            {
                StartSeconds = analysis.Region.StartSeconds,
                EndSeconds = analysis.Region.EndSeconds,
                DurationSeconds = analysis.Region.DurationSeconds,
            },
            Channels = channelPoints,
            TimeAxisTicks = analysis.TimeAxisTicks,
            FrequencyAxisTicks = analysis.FrequencyAxisTicks,
        };
    }
}
