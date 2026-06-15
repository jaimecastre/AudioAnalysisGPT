using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class SpectrumAnalyzer
{
    private const string AveragingMethod = "power";
    private const string ScalingDescription = "one-sided amplitude, coherent-gain corrected";

    public static SpectrumAnalysis Analyze(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        SpectrumWindowType windowType = SpectrumWindowType.Hann
    )
    {
        var channelResults = new List<ChannelSpectrumAnalysis>();

        foreach (var channel in channels)
        {
            var channelResult = AnalyzeChannel(
                channel,
                startSeconds,
                endSeconds,
                fftSize,
                overlap,
                windowType
            );
            channelResults.Add(channelResult);
        }

        // Use block count from first channel (all channels share the same time region and sample rate).
        var blockCount =
            channelResults.Count > 0
                ? SpectrumFftEngine.GetBlockCount(
                    channels[0].SampleRate,
                    startSeconds,
                    endSeconds,
                    fftSize,
                    overlap
                )
                : 0;

        var parameters = new SpectrumParameters
        {
            FftSize = fftSize,
            WindowType = windowType.ToString().ToLowerInvariant(),
            Overlap = overlap,
            Averaging = AveragingMethod,
            Scaling = ScalingDescription,
            StartTimeSeconds = startSeconds,
            EndTimeSeconds = endSeconds,
            BlockCount = blockCount,
        };

        var region = new TimeRange
        {
            StartSeconds = startSeconds,
            EndSeconds = endSeconds,
            DurationSeconds = Math.Max(0.0, endSeconds - startSeconds),
        };

        return new SpectrumAnalysis
        {
            Channels = channelResults,
            Parameters = parameters,
            Region = region,
        };
    }

    private static ChannelSpectrumAnalysis AnalyzeChannel(
        SignalChannel channel,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap,
        SpectrumWindowType windowType
    )
    {
        var sampleRate = channel.SampleRate;
        var samples = channel.Samples;

        var startSample = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);

        startSample = Math.Clamp(startSample, 0, samples.Length);
        endSample = Math.Clamp(endSample, 0, samples.Length);

        var spectrumData = SpectrumFftEngine.ComputeAveragedSpectrum(
            samples,
            startSample,
            endSample,
            sampleRate,
            fftSize,
            overlap,
            windowType
        );

        // All channels use the acoustic pressure path: Pa or digital with 0 dBFS = 91 dB SPL.
        // GetScaleFactor returns 1.0 for both PressurePascal and DigitalFullScale.
        var scaleFactor =
            channel.PhysicalMetadata != null
                ? AcousticPressureConverter.GetScaleFactor(channel.PhysicalMetadata)
                : 1.0;
        SpectrumFftEngine.ApplyAcousticPressureDbInPlace(
            spectrumData.Magnitudes,
            spectrumData.MagnitudesDb,
            scaleFactor
        );

        // Find peak bin, then apply quadratic interpolation for sub-bin frequency accuracy.
        double? maxMagnitude = null;
        double? maxMagnitudeDb = null;
        double? peakFrequencyHz = null;
        var peakBinIndex = -1;

        for (var i = 0; i < spectrumData.FrequenciesHz.Length; i++)
        {
            if (maxMagnitude == null || spectrumData.Magnitudes[i] > maxMagnitude.Value)
            {
                maxMagnitude = spectrumData.Magnitudes[i];
                maxMagnitudeDb = spectrumData.MagnitudesDb[i];
                peakFrequencyHz = spectrumData.FrequenciesHz[i];
                peakBinIndex = i;
            }
        }

        if (peakBinIndex > 0 && peakBinIndex < spectrumData.FrequenciesHz.Length - 1)
        {
            var interpolatedHz = TonalPeakDetector.QuadraticInterpolateFrequencyHz(
                spectrumData.Magnitudes,
                spectrumData.FrequenciesHz,
                peakBinIndex
            );
            if (interpolatedHz.HasValue)
            {
                peakFrequencyHz = interpolatedHz.Value;
            }
        }

        var tonalPeaks = TonalPeakDetector.Detect(
            spectrumData.FrequenciesHz,
            spectrumData.Magnitudes,
            spectrumData.MagnitudesDb
        );

        return new ChannelSpectrumAnalysis
        {
            ChannelId = channel.Id,
            ChannelName = channel.Name,
            Quantity = channel.Quantity,
            Unit = channel.Unit,
            FrequenciesHz = spectrumData.FrequenciesHz,
            Magnitudes = spectrumData.Magnitudes,
            MagnitudesDb = spectrumData.MagnitudesDb,
            MaxMagnitude = maxMagnitude.HasValue ? Math.Round(maxMagnitude.Value, 6) : null,
            MaxMagnitudeDb = maxMagnitudeDb.HasValue ? Math.Round(maxMagnitudeDb.Value, 3) : null,
            PeakFrequencyHz = peakFrequencyHz.HasValue
                ? Math.Round(peakFrequencyHz.Value, 3)
                : null,
            TonalPeaks = tonalPeaks,
            DbUnit = "dB SPL",
            DbReferenceValue = AcousticPressureConverter.PressureReferencePa,
            DbReferenceUnit = "Pa",
            YAxisLabel = AcousticPressureConverter.ResolveYAxisLabel(channel.PhysicalMetadata),
            CalibrationState = AcousticPressureConverter.ResolveCalibrationState(
                channel.PhysicalMetadata
            ),
            PhysicalQuantity = AcousticPressureConverter.ResolvePhysicalQuantity(
                channel.PhysicalMetadata
            ),
        };
    }
}
