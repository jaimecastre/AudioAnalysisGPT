using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Handlers;

public static class CompareResultBuilder
{
    private const int DefaultFftSize = 44100;
    private const double DefaultOverlap = 0.5;
    private const string DefaultCpbBandMode = "third_octave";

    private static readonly (string Name, double LowHz, double HighHz)[] NamedBands =
    [
        ("sub", 20.0, 80.0),
        ("low", 80.0, 250.0),
        ("low_mid", 250.0, 800.0),
        ("mid", 800.0, 2500.0),
        ("presence", 2500.0, 5000.0),
        ("high", 5000.0, 10000.0),
        ("air", 10000.0, 20000.0),
    ];

    public static IReadOnlyList<CompareCpbBand> ComputeCpbBands(
        SpectrumAnalysis spectrumAnalysis,
        double startSeconds,
        double endSeconds,
        int sampleRate
    )
    {
        var cpbAnalysis = CpbAnalyzer.AnalyzeFromSpectrum(
            spectrumAnalysis,
            startSeconds,
            endSeconds,
            DefaultCpbBandMode,
            DefaultFftSize,
            DefaultOverlap,
            sampleRate
        );

        var firstChannel = cpbAnalysis.Channels.Count > 0 ? cpbAnalysis.Channels[0] : null;
        if (firstChannel is null)
        {
            return [];
        }

        return firstChannel
            .Bands.Select(band => new CompareCpbBand
            {
                Label = band.Label,
                CenterFrequencyHz = band.CenterFrequencyHz,
                LowerFrequencyHz = band.LowerFrequencyHz,
                UpperFrequencyHz = band.UpperFrequencyHz,
                LevelDb = band.LevelDb,
                Weighting = cpbAnalysis.Parameters.Weighting,
                WeightingMethod = cpbAnalysis.Parameters.WeightingMethod,
            })
            .ToArray();
    }

    public static CompareSpectrumCurve BuildSpectrumCurve(ChannelSpectrumAnalysis? channel)
    {
        if (channel == null)
        {
            return new CompareSpectrumCurve
            {
                FrequenciesHz = [],
                MagnitudesDb = [],
                FftSize = DefaultFftSize,
                Overlap = DefaultOverlap,
            };
        }

        return new CompareSpectrumCurve
        {
            FrequenciesHz = channel.FrequenciesHz,
            MagnitudesDb = channel.MagnitudesDb,
            FftSize = DefaultFftSize,
            Overlap = DefaultOverlap,
        };
    }

    public static IReadOnlyList<CompareBandEnergy> ComputeBandEnergies(
        ChannelSpectrumAnalysis? channel
    )
    {
        var results = new List<CompareBandEnergy>();

        if (channel == null)
        {
            return results;
        }

        var frequenciesHz = channel.FrequenciesHz;
        var magnitudes = channel.Magnitudes;

        foreach (var (bandName, lowHz, highHz) in NamedBands)
        {
            var totalPower = 0.0;
            var binCount = 0;

            for (int k = 0; k < frequenciesHz.Count; k++)
            {
                var freqHz = frequenciesHz[k];
                if (freqHz >= lowHz && freqHz < highHz)
                {
                    totalPower += magnitudes[k] * magnitudes[k];
                    binCount++;
                }
            }

            double energyDb;
            if (binCount > 0 && totalPower > 0.0)
            {
                var rmsAmplitude = Math.Sqrt(totalPower / binCount);
                energyDb = Math.Round(20.0 * Math.Log10(rmsAmplitude), 2);
            }
            else
            {
                energyDb = double.NegativeInfinity;
            }

            results.Add(
                new CompareBandEnergy
                {
                    BandName = bandName,
                    LowHz = lowHz,
                    HighHz = highHz,
                    EnergyDb = energyDb,
                }
            );
        }

        return results;
    }

    public static CompareSpectrumDelta BuildSpectrumDelta(
        CompareSpectrumCurve curveA,
        CompareSpectrumCurve curveB
    )
    {
        var length = Math.Min(curveA.FrequenciesHz.Count, curveB.FrequenciesHz.Count);
        var frequencies = new double[length];
        var deltaDb = new double?[length];

        for (int k = 0; k < length; k++)
        {
            frequencies[k] = curveA.FrequenciesHz[k];
            var magnitudeDbA = curveA.MagnitudesDb[k];
            var magnitudeDbB = curveB.MagnitudesDb[k];

            if (magnitudeDbA.HasValue && magnitudeDbB.HasValue)
            {
                deltaDb[k] = Math.Round(magnitudeDbB.Value - magnitudeDbA.Value, 3);
            }
            else
            {
                deltaDb[k] = null;
            }
        }

        return new CompareSpectrumDelta { FrequenciesHz = frequencies, DeltaDb = deltaDb };
    }

    public static IReadOnlyList<CompareBandEnergy> BuildBandEnergyDeltas(
        IReadOnlyList<CompareBandEnergy> bandEnergiesA,
        IReadOnlyList<CompareBandEnergy> bandEnergiesB
    )
    {
        var deltas = new List<CompareBandEnergy>();

        for (int i = 0; i < bandEnergiesA.Count && i < bandEnergiesB.Count; i++)
        {
            var a = bandEnergiesA[i];
            var b = bandEnergiesB[i];
            var deltaDb =
                double.IsNegativeInfinity(a.EnergyDb) || double.IsNegativeInfinity(b.EnergyDb)
                    ? double.NegativeInfinity
                    : Math.Round(b.EnergyDb - a.EnergyDb, 2);

            deltas.Add(
                new CompareBandEnergy
                {
                    BandName = a.BandName,
                    LowHz = a.LowHz,
                    HighHz = a.HighHz,
                    EnergyDb = deltaDb,
                }
            );
        }

        return deltas;
    }

    public static IReadOnlyList<CompareCpbBand> BuildCpbBandDeltas(
        IReadOnlyList<CompareCpbBand> cpbBandsA,
        IReadOnlyList<CompareCpbBand> cpbBandsB
    )
    {
        var deltas = new List<CompareCpbBand>();

        for (int i = 0; i < cpbBandsA.Count && i < cpbBandsB.Count; i++)
        {
            var a = cpbBandsA[i];
            var b = cpbBandsB[i];
            var deltaDb =
                a.LevelDb.HasValue && b.LevelDb.HasValue
                    ? Math.Round(b.LevelDb.Value - a.LevelDb.Value, 2)
                    : (double?)null;

            deltas.Add(
                new CompareCpbBand
                {
                    Label = a.Label,
                    CenterFrequencyHz = a.CenterFrequencyHz,
                    LowerFrequencyHz = a.LowerFrequencyHz,
                    UpperFrequencyHz = a.UpperFrequencyHz,
                    LevelDb = deltaDb,
                    Weighting = a.Weighting,
                    WeightingMethod = a.WeightingMethod,
                }
            );
        }

        return deltas;
    }
}
