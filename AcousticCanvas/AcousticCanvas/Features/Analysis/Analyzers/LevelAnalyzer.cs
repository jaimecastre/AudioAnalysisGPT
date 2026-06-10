using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class LevelAnalyzer
{
    public static LevelAnalysis Analyze(IReadOnlyList<SignalChannel> channels)
    {
        var channelResults = new ChannelLevelAnalysis[channels.Count];

        for (var index = 0; index < channels.Count; index++)
        {
            channelResults[index] = AnalyzeChannel(channels[index]);
        }

        var combined = channels.Count > 1
            ? AnalyzeCombined(channels)
            : null;

        return new LevelAnalysis
        {
            Channels = channelResults,
            Combined = combined,
        };
    }

    public static LevelAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds)
    {
        if (channels.Count == 0)
        {
            return new LevelAnalysis { Channels = [], Combined = null };
        }

        var sampleRate = channels[0].SampleRate;
        var maxSamples = channels[0].Samples.Length;
        var startSample = Math.Clamp((int)Math.Floor(startSeconds * sampleRate), 0, maxSamples);
        var endSample = Math.Clamp((int)Math.Ceiling(endSeconds * sampleRate), 0, maxSamples);

        var channelResults = new ChannelLevelAnalysis[channels.Count];
        for (var index = 0; index < channels.Count; index++)
        {
            var channel = channels[index];
            channelResults[index] = ComputeLevelAnalysis(
                channelId: channel.Id,
                channelName: channel.Name,
                quantity: channel.Quantity,
                unit: channel.Unit,
                samples: channel.Samples,
                dbReference: channel.DbReference,
                isCalibrated: channel.Calibration?.IsCalibrated ?? false,
                startIndex: startSample,
                endIndex: endSample);
        }

        var combined = channels.Count > 1
            ? AnalyzeCombinedRegion(channels, startSample, endSample)
            : null;

        return new LevelAnalysis
        {
            Channels = channelResults,
            Combined = combined,
        };
    }

    public static ChannelLevelAnalysis AnalyzeChannel(SignalChannel channel)
    {
        return ComputeLevelAnalysis(
            channelId: channel.Id,
            channelName: channel.Name,
            quantity: channel.Quantity,
            unit: channel.Unit,
            samples: channel.Samples,
            dbReference: channel.DbReference,
            isCalibrated: channel.Calibration?.IsCalibrated ?? false
        );
    }

    private static ChannelLevelAnalysis AnalyzeCombinedRegion(
        IReadOnlyList<SignalChannel> channels,
        int startSample,
        int endSample)
    {
        var regionLength = endSample - startSample;
        var channelCount = channels.Count;
        var combinedSamples = new float[regionLength];

        for (var frameIndex = 0; frameIndex < regionLength; frameIndex++)
        {
            var sum = 0.0;
            for (var channelIndex = 0; channelIndex < channelCount; channelIndex++)
            {
                var samples = channels[channelIndex].Samples;
                var sampleIndex = startSample + frameIndex;
                if (sampleIndex < samples.Length)
                {
                    sum += samples[sampleIndex];
                }
            }
            combinedSamples[frameIndex] = (float)(sum / channelCount);
        }

        var referenceChannel = channels[0];
        return ComputeLevelAnalysis(
            channelId: "combined",
            channelName: "Combined",
            quantity: referenceChannel.Quantity,
            unit: referenceChannel.Unit,
            samples: combinedSamples,
            dbReference: referenceChannel.DbReference,
            isCalibrated: referenceChannel.Calibration?.IsCalibrated ?? false);
    }

    private static ChannelLevelAnalysis AnalyzeCombined(IReadOnlyList<SignalChannel> channels)
    {
        var combinedSamples = ComputeChannelAverage(channels);

        // Use the first channel's metadata for the combined result.
        // All channels in the same WAV share the same unit, quantity, and reference.
        var referenceChannel = channels[0];

        return ComputeLevelAnalysis(
            channelId: "combined",
            channelName: "Combined",
            quantity: referenceChannel.Quantity,
            unit: referenceChannel.Unit,
            samples: combinedSamples,
            dbReference: referenceChannel.DbReference,
            isCalibrated: referenceChannel.Calibration?.IsCalibrated ?? false
        );
    }

    private static float[] ComputeChannelAverage(IReadOnlyList<SignalChannel> channels)
    {
        var frameCount = (int)channels[0].SampleCount;
        var channelCount = channels.Count;
        var averaged = new float[frameCount];

        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++)
        {
            var sum = 0.0;
            for (var channelIndex = 0; channelIndex < channelCount; channelIndex++)
            {
                var samples = channels[channelIndex].Samples;
                if (frameIndex < samples.Length)
                {
                    sum += samples[frameIndex];
                }
            }
            averaged[frameIndex] = (float)(sum / channelCount);
        }

        return averaged;
    }

    private static ChannelLevelAnalysis ComputeLevelAnalysis(
        string channelId,
        string channelName,
        string quantity,
        string unit,
        float[] samples,
        DbReference? dbReference,
        bool isCalibrated,
        int startIndex = 0,
        int endIndex = -1)
    {
        var end = endIndex < 0 ? samples.Length : endIndex;
        var sampleCount = end - startIndex;

        if (sampleCount <= 0)
        {
            return BuildSilentResult(channelId, channelName, quantity, unit, dbReference, isCalibrated);
        }

        var min = double.MaxValue;
        var max = double.MinValue;
        var sumSquares = 0.0;
        var sum = 0.0;

        for (var i = startIndex; i < end; i++)
        {
            var sample = (double)samples[i];
            if (sample < min) min = sample;
            if (sample > max) max = sample;
            sum += sample;
            sumSquares += sample * sample;
        }

        var peak = Math.Max(Math.Abs(min), Math.Abs(max));
        var rms = Math.Sqrt(sumSquares / sampleCount);
        var dcOffset = sum / sampleCount;

        var peakDb = ComputeDb(peak, dbReference);
        var rmsDb = ComputeDb(rms, dbReference);

        var crestFactor = rms > 0.0 ? peak / rms : (double?)null;
        var crestFactorDb = crestFactor.HasValue ? 20.0 * Math.Log10(crestFactor.Value) : (double?)null;

        return new ChannelLevelAnalysis
        {
            ChannelId = channelId,
            ChannelName = channelName,
            Quantity = quantity,
            Unit = unit,
            Min = Round(min),
            Max = Round(max),
            Peak = Round(peak),
            Rms = Round(rms),
            DcOffset = Round(dcOffset),
            PeakDb = peakDb.HasValue ? Round(peakDb.Value) : null,
            RmsDb = rmsDb.HasValue ? Round(rmsDb.Value) : null,
            DbUnit = dbReference?.DbUnit,
            DbReferenceValue = dbReference?.Value,
            DbReferenceUnit = dbReference?.Unit,
            CrestFactor = crestFactor.HasValue ? Round(crestFactor.Value) : null,
            CrestFactorDb = crestFactorDb.HasValue ? Round(crestFactorDb.Value) : null,
            IsCalibrated = isCalibrated,
        };
    }

    private static double? ComputeDb(double value, DbReference? reference)
    {
        if (reference is null || reference.Value <= 0.0 || value <= 0.0)
        {
            return null;
        }
        return 20.0 * Math.Log10(value / reference.Value);
    }

    private static ChannelLevelAnalysis BuildSilentResult(
        string channelId,
        string channelName,
        string quantity,
        string unit,
        DbReference? dbReference,
        bool isCalibrated)
    {
        return new ChannelLevelAnalysis
        {
            ChannelId = channelId,
            ChannelName = channelName,
            Quantity = quantity,
            Unit = unit,
            Min = 0,
            Max = 0,
            Peak = 0,
            Rms = 0,
            DcOffset = 0,
            PeakDb = null,
            RmsDb = null,
            DbUnit = dbReference?.DbUnit,
            DbReferenceValue = dbReference?.Value,
            DbReferenceUnit = dbReference?.Unit,
            CrestFactor = null,
            CrestFactorDb = null,
            IsCalibrated = isCalibrated,
        };
    }

    private static double Round(double value) => Math.Round(value, 6);
}
