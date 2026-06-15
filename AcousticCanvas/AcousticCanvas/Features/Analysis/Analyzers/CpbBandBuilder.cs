namespace AcousticCanvas.Features.Analysis.Analyzers;

public static class CpbBandBuilder
{
    private static readonly double[] OctaveCentersHz =
    [
        31.5,
        63,
        125,
        250,
        500,
        1000,
        2000,
        4000,
        8000,
        16000,
    ];

    private static readonly double[] ThirdOctaveCentersHz =
    [
        20,
        25,
        31.5,
        40,
        50,
        63,
        80,
        100,
        125,
        160,
        200,
        250,
        315,
        400,
        500,
        630,
        800,
        1000,
        1250,
        1600,
        2000,
        2500,
        3150,
        4000,
        5000,
        6300,
        8000,
        10000,
        12500,
        16000,
        20000,
    ];

    public static IReadOnlyList<CpbBandDefinition> BuildBands(
        string bandMode,
        int bandsPerOctave,
        double nyquistHz
    )
    {
        var centers = bandMode == "octave" ? OctaveCentersHz : ThirdOctaveCentersHz;
        var edgeRatio = Math.Pow(2.0, 1.0 / (2.0 * bandsPerOctave));
        var bands = centers
            .Select(center => new CpbBandDefinition(center, center / edgeRatio, center * edgeRatio))
            .Where(band => band.UpperFrequencyHz >= 20.0 && band.LowerFrequencyHz < nyquistHz)
            .ToArray();

        for (var i = 0; i < bands.Length; i++)
        {
            var plotLower =
                i == 0
                    ? bands[i].LowerFrequencyHz
                    : Math.Sqrt(bands[i - 1].UpperFrequencyHz * bands[i].LowerFrequencyHz);
            var plotUpper =
                i == bands.Length - 1
                    ? bands[i].UpperFrequencyHz
                    : Math.Sqrt(bands[i].UpperFrequencyHz * bands[i + 1].LowerFrequencyHz);
            bands[i] = bands[i] with
            {
                PlotLowerFrequencyHz = plotLower,
                PlotUpperFrequencyHz = plotUpper,
            };
        }

        return bands;
    }

    public static string NormalizeBandMode(string bandMode)
    {
        return bandMode.Equals("octave", StringComparison.OrdinalIgnoreCase)
            ? "octave"
            : "third_octave";
    }

    public static string FormatBandLabel(double frequencyHz)
    {
        return frequencyHz >= 1000.0 ? $"{frequencyHz / 1000.0:0.##}k" : $"{frequencyHz:0.##}";
    }
}

public readonly record struct CpbBandDefinition(
    double CenterFrequencyHz,
    double LowerFrequencyHz,
    double UpperFrequencyHz,
    double PlotLowerFrequencyHz = 0.0,
    double PlotUpperFrequencyHz = 0.0
);
