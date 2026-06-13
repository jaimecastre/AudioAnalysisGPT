namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class FftSizeCalculator
{
    /// <summary>
    /// Computes the smallest FFT size where <paramref name="targetFrequencyHz"/>
    /// lands exactly on an integer bin for the given <paramref name="sampleRate"/>.
    /// </summary>
    /// <remarks>
    /// Math: N = sampleRate / GCD(sampleRate, round(targetFrequencyHz))
    /// For 44100 Hz sample rate and 1000 Hz target: GCD(44100, 1000) = 100 → N = 441.
    /// Bin spacing = 44100 / 441 = 100 Hz, so 1000 Hz lands on bin 10.
    /// </remarks>
    public static int ComputeCoherentSize(int sampleRate, double targetFrequencyHz)
    {
        var targetInt = (int)Math.Round(targetFrequencyHz);
        if (targetInt <= 0)
        {
            throw new ArgumentException(
                $"Target frequency must be positive, got {targetFrequencyHz}",
                nameof(targetFrequencyHz)
            );
        }

        var g = Gcd(sampleRate, targetInt);
        return sampleRate / g;
    }

    /// <summary>
    /// Computes a coherent FFT size with <paramref name="cycleMultiplier"/> times
    /// the minimum length. Larger multipliers give finer frequency resolution
    /// while preserving exact bin alignment.
    /// </summary>
    /// <remarks>
    /// For 44100 Hz / 1000 Hz with cycleMultiplier = 100:
    /// N = 441 * 100 = 44100 → bin spacing = 1 Hz, 1000 Hz lands on bin 1000.
    /// </remarks>
    public static int ComputeCoherentSize(int sampleRate, double targetFrequencyHz, int cycleMultiplier)
    {
        if (cycleMultiplier < 1)
        {
            throw new ArgumentException(
                "Cycle multiplier must be at least 1.",
                nameof(cycleMultiplier)
            );
        }

        var baseSize = ComputeCoherentSize(sampleRate, targetFrequencyHz);
        return baseSize * cycleMultiplier;
    }

    private static int Gcd(int a, int b)
    {
        while (b != 0)
        {
            var temp = b;
            b = a % b;
            a = temp;
        }

        return a;
    }
}
