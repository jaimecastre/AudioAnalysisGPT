using System.Numerics;
using AcousticCanvas.Features.Analysis.Domain;
using MathNet.Numerics.IntegralTransforms;

namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class SpectrumFftEngine
{
    public static SpectrumData ComputeAveragedSpectrum(
        float[] samples,
        int startSample,
        int endSample,
        int sampleRate,
        int fftSize,
        double overlap,
        SpectrumWindowType windowType
    )
    {
        var halfFftSize = fftSize / 2 + 1;
        var window = BuildWindow(fftSize, windowType);

        var coherentGain = 0.0;
        for (var i = 0; i < fftSize; i++)
        {
            coherentGain += window[i];
        }
        coherentGain /= fftSize;

        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));
        var powerAccumulator = new double[halfFftSize];
        var blockCount = 0;
        var blockStart = startSample;

        do
        {
            var remainingInRegion = Math.Max(0, endSample - blockStart);
            var block = ExtractBlock(samples, blockStart, fftSize, remainingInRegion);

            var complexBlock = new Complex[fftSize];
            for (var i = 0; i < fftSize; i++)
            {
                complexBlock[i] = new Complex(block[i] * window[i], 0.0);
            }

            Fourier.Forward(complexBlock, FourierOptions.NoScaling);

            for (var k = 0; k < halfFftSize; k++)
            {
                var rawMagnitude = complexBlock[k].Magnitude;
                var amplitude = rawMagnitude / (fftSize * coherentGain);

                if (k > 0 && k < halfFftSize - 1)
                {
                    amplitude *= 2.0;
                }

                powerAccumulator[k] += amplitude * amplitude;
            }

            blockCount++;
            blockStart += hopSize;
        } while (blockStart + fftSize <= endSample);

        var actualBlockCount = Math.Max(blockCount, 1);
        var frequenciesHz = new double[halfFftSize];
        var magnitudes = new double[halfFftSize];
        var magnitudesDb = new double?[halfFftSize];

        for (var k = 0; k < halfFftSize; k++)
        {
            var meanPower = powerAccumulator[k] / actualBlockCount;
            var meanMagnitude = Math.Sqrt(meanPower);

            frequenciesHz[k] = Math.Round((double)k * sampleRate / fftSize, 6);
            magnitudes[k] = Math.Round(meanMagnitude, 9);
            magnitudesDb[k] = null;
        }

        return new SpectrumData(frequenciesHz, magnitudes, magnitudesDb);
    }

    public static void ApplyDbReferenceInPlace(
        double[] magnitudes,
        double?[] magnitudesDb,
        DbReference dbReference
    )
    {
        if (dbReference.Value <= 0)
        {
            return;
        }

        for (var i = 0; i < magnitudes.Length; i++)
        {
            if (magnitudes[i] > 0)
            {
                magnitudesDb[i] = Math.Round(
                    20.0 * Math.Log10(magnitudes[i] / dbReference.Value),
                    3
                );
            }
        }
    }

    public static void ApplyAcousticPressureDbInPlace(
        double[] magnitudes,
        double?[] magnitudesDb,
        double scaleFactor
    )
    {
        for (var i = 0; i < magnitudes.Length; i++)
        {
            if (magnitudes[i] > 0)
            {
                var peakAmplitudePa = magnitudes[i] * scaleFactor;
                magnitudesDb[i] = Math.Round(
                    AcousticPressureConverter.ComputeDbSplFromPeakAmplitude(peakAmplitudePa),
                    3
                );
            }
        }
    }

    private static double[] BuildWindow(int size, SpectrumWindowType windowType)
    {
        return windowType switch
        {
            SpectrumWindowType.Rectangular => BuildRectangularWindow(size),
            SpectrumWindowType.Hann => BuildPeriodicHannWindow(size),
            _ => BuildPeriodicHannWindow(size),
        };
    }

    private static double[] BuildRectangularWindow(int size)
    {
        var window = new double[size];
        for (var n = 0; n < size; n++)
        {
            window[n] = 1.0;
        }
        return window;
    }

    private static double[] BuildPeriodicHannWindow(int size)
    {
        var window = new double[size];
        for (var n = 0; n < size; n++)
        {
            window[n] = 0.5 * (1.0 - Math.Cos(2.0 * Math.PI * n / size));
        }
        return window;
    }

    private static double[] ExtractBlock(
        float[] samples,
        int startIndex,
        int fftSize,
        int remainingInRegion
    )
    {
        var block = new double[fftSize];
        var availableInFile = samples.Length - startIndex;
        var available = Math.Min(fftSize, availableInFile);
        available = Math.Min(available, remainingInRegion);
        available = Math.Max(available, 0);

        for (var i = 0; i < available; i++)
        {
            block[i] = samples[startIndex + i];
        }

        return block;
    }

    public static int GetBlockCount(
        int sampleRate,
        double startSeconds,
        double endSeconds,
        int fftSize,
        double overlap
    )
    {
        var startSample = (int)Math.Floor(startSeconds * sampleRate);
        var endSample = (int)Math.Ceiling(endSeconds * sampleRate);
        var hopSize = (int)Math.Max(1, fftSize * (1.0 - overlap));

        if (endSample - startSample <= 0)
        {
            return 1;
        }

        var count = 0;
        var pos = startSample;
        do
        {
            count++;
            pos += hopSize;
        } while (pos + fftSize <= endSample);

        return Math.Max(count, 1);
    }
}

public readonly record struct SpectrumData(
    double[] FrequenciesHz,
    double[] Magnitudes,
    double?[] MagnitudesDb
);
