using FastEndpoints;
using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;
using AcousticCanvas.Features.Analysis.Services;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunCompareHandler(SignalAnalysisService analysisService)
    : CommandHandler<RunCompareCommand, CompareResult>
{
    private const int DefaultFftSize = 8192;
    private const double DefaultOverlap = 0.5;
    private const string DefaultCpbBandMode = "third_octave";

    private static readonly (string Name, double LowHz, double HighHz)[] NamedBands =
    [
        ("sub",       20.0,    80.0),
        ("low",       80.0,   250.0),
        ("low_mid",  250.0,   800.0),
        ("mid",      800.0,  2500.0),
        ("presence", 2500.0, 5000.0),
        ("high",     5000.0, 10000.0),
        ("air",     10000.0, 20000.0),
    ];

    public override Task<CompareResult> ExecuteAsync(RunCompareCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (command.FilePaths.Count < 2)
        {
            throw new ArgumentException("At least two files are required for comparison.");
        }

        for (int index = 0; index < command.FilePaths.Count; index++)
        {
            if (!File.Exists(command.FilePaths[index]))
            {
                throw new FileNotFoundException($"Audio file {index + 1} not found: {command.FilePaths[index]}");
            }
        }

        var summaries = new List<CompareFileSummary>();
        for (int index = 0; index < command.FilePaths.Count; index++)
        {
            var summary = BuildFileSummary(command.FilePaths[index], command.StartSeconds, command.EndSeconds);
            summaries.Add(summary);
        }

        var pairwiseDiffs = new List<PairwiseDiff>();
        for (int i = 0; i < summaries.Count; i++)
        {
            for (int j = i + 1; j < summaries.Count; j++)
            {
                var a = summaries[i];
                var b = summaries[j];
                var spectrumDelta = BuildSpectrumDelta(a.SpectrumCurve, b.SpectrumCurve);
                var bandEnergyDeltas = BuildBandEnergyDeltas(a.BandEnergies, b.BandEnergies);
                var cpbBandDeltas = BuildCpbBandDeltas(a.CpbBands, b.CpbBands);

                pairwiseDiffs.Add(new PairwiseDiff
                {
                    FileIdA = a.FileId,
                    FileIdB = b.FileId,
                    PeakDeltaDb = b.PeakDb - a.PeakDb,
                    HigherPeakFileId = a.PeakDb >= b.PeakDb ? a.FileId : b.FileId,
                    RmsDeltaDb = b.RmsDb - a.RmsDb,
                    HigherRmsFileId = a.RmsDb >= b.RmsDb ? a.FileId : b.FileId,
                    CrestFactorDeltaDb = b.CrestFactorDb - a.CrestFactorDb,
                    HigherCrestFactorFileId = a.CrestFactorDb >= b.CrestFactorDb ? a.FileId : b.FileId,
                    PeakFrequencyDeltaHz = b.PeakFrequencyHz - a.PeakFrequencyHz,
                    HigherPeakFrequencyFileId = a.PeakFrequencyHz >= b.PeakFrequencyHz ? a.FileId : b.FileId,
                    SpectrumDelta = spectrumDelta,
                    BandEnergyDeltas = bandEnergyDeltas,
                    CpbBandDeltas = cpbBandDeltas,
                });
            }
        }

        return Task.FromResult(new CompareResult
        {
            Files = summaries,
            PairwiseDiffs = pairwiseDiffs,
            RanAt = DateTimeOffset.UtcNow,
        });
    }

    private CompareFileSummary BuildFileSummary(
        string filePath,
        double? startSeconds,
        double? endSeconds)
    {
        var signalFile = analysisService.ImportFile(filePath);
        var duration = signalFile.FileInfo.DurationSeconds;
        var resolvedStart = startSeconds ?? 0.0;
        var resolvedEnd = endSeconds ?? duration;

        var levelAnalysis = LevelAnalyzer.Analyze(signalFile.Channels);
        var firstLevelChannel = levelAnalysis.Channels.Count > 0 ? levelAnalysis.Channels[0] : null;
        var peakDb = firstLevelChannel?.PeakDb ?? 0.0;
        var rmsDb = firstLevelChannel?.RmsDb ?? 0.0;
        var crestFactorDb = firstLevelChannel?.CrestFactorDb ?? 0.0;

        var spectrumAnalysis = SpectrumAnalyzer.Analyze(
            signalFile.Channels,
            resolvedStart,
            resolvedEnd,
            DefaultFftSize,
            DefaultOverlap);

        var firstSpectrumChannel = spectrumAnalysis.Channels.Count > 0 ? spectrumAnalysis.Channels[0] : null;
        var peakFrequencyHz = firstSpectrumChannel?.PeakFrequencyHz ?? 0.0;
        var peakFrequencyMagnitudeDb = firstSpectrumChannel?.MaxMagnitudeDb ?? 0.0;

        var spectrumCurve = BuildSpectrumCurve(firstSpectrumChannel);
        var bandEnergies = ComputeBandEnergies(firstSpectrumChannel);
        var cpbBands = ComputeCpbBands(signalFile.Channels, resolvedStart, resolvedEnd);

        var storedFileName = Path.GetFileName(filePath);
        var displayFileName = storedFileName.Length > 13 && storedFileName[12] == '_'
            ? storedFileName[13..]
            : storedFileName;

        return new CompareFileSummary
        {
            FileId = filePath,
            FileName = displayFileName,
            PeakDb = peakDb,
            RmsDb = rmsDb,
            CrestFactorDb = crestFactorDb,
            PeakFrequencyHz = peakFrequencyHz,
            PeakFrequencyMagnitudeDb = peakFrequencyMagnitudeDb,
            RegionStartSeconds = resolvedStart,
            RegionEndSeconds = resolvedEnd,
            SpectrumCurve = spectrumCurve,
            BandEnergies = bandEnergies,
            CpbBands = cpbBands,
        };
    }

    private static IReadOnlyList<CompareCpbBand> ComputeCpbBands(
        IReadOnlyList<SignalChannel> channels,
        double startSeconds,
        double endSeconds)
    {
        var cpbAnalysis = CpbAnalyzer.Analyze(
            channels,
            startSeconds,
            endSeconds,
            DefaultCpbBandMode,
            DefaultFftSize,
            DefaultOverlap);

        var firstChannel = cpbAnalysis.Channels.Count > 0 ? cpbAnalysis.Channels[0] : null;
        if (firstChannel is null)
        {
            return [];
        }

        return firstChannel.Bands.Select(band => new CompareCpbBand
        {
            Label = band.Label,
            CenterFrequencyHz = band.CenterFrequencyHz,
            LowerFrequencyHz = band.LowerFrequencyHz,
            UpperFrequencyHz = band.UpperFrequencyHz,
            LevelDb = band.LevelDb,
        }).ToArray();
    }

    private static CompareSpectrumCurve BuildSpectrumCurve(ChannelSpectrumAnalysis? channel)
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

    private static IReadOnlyList<CompareBandEnergy> ComputeBandEnergies(ChannelSpectrumAnalysis? channel)
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

            results.Add(new CompareBandEnergy
            {
                BandName = bandName,
                LowHz = lowHz,
                HighHz = highHz,
                EnergyDb = energyDb,
            });
        }

        return results;
    }

    private static CompareSpectrumDelta BuildSpectrumDelta(
        CompareSpectrumCurve curveA,
        CompareSpectrumCurve curveB)
    {
        // Use the shorter length to stay within both arrays.
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

        return new CompareSpectrumDelta
        {
            FrequenciesHz = frequencies,
            DeltaDb = deltaDb,
        };
    }

    private static IReadOnlyList<CompareBandEnergy> BuildBandEnergyDeltas(
        IReadOnlyList<CompareBandEnergy> bandEnergiesA,
        IReadOnlyList<CompareBandEnergy> bandEnergiesB)
    {
        var deltas = new List<CompareBandEnergy>();

        for (int i = 0; i < bandEnergiesA.Count && i < bandEnergiesB.Count; i++)
        {
            var a = bandEnergiesA[i];
            var b = bandEnergiesB[i];

            var deltaDb = double.IsNegativeInfinity(a.EnergyDb) || double.IsNegativeInfinity(b.EnergyDb)
                ? double.NegativeInfinity
                : Math.Round(b.EnergyDb - a.EnergyDb, 2);

            deltas.Add(new CompareBandEnergy
            {
                BandName = a.BandName,
                LowHz = a.LowHz,
                HighHz = a.HighHz,
                EnergyDb = deltaDb,
            });
        }

        return deltas;
    }

    private static IReadOnlyList<CompareCpbBand> BuildCpbBandDeltas(
        IReadOnlyList<CompareCpbBand> cpbBandsA,
        IReadOnlyList<CompareCpbBand> cpbBandsB)
    {
        var deltas = new List<CompareCpbBand>();

        for (int i = 0; i < cpbBandsA.Count && i < cpbBandsB.Count; i++)
        {
            var a = cpbBandsA[i];
            var b = cpbBandsB[i];
            var deltaDb = a.LevelDb.HasValue && b.LevelDb.HasValue
                ? Math.Round(b.LevelDb.Value - a.LevelDb.Value, 2)
                : (double?)null;

            deltas.Add(new CompareCpbBand
            {
                Label = a.Label,
                CenterFrequencyHz = a.CenterFrequencyHz,
                LowerFrequencyHz = a.LowerFrequencyHz,
                UpperFrequencyHz = a.UpperFrequencyHz,
                LevelDb = deltaDb,
            });
        }

        return deltas;
    }
}
