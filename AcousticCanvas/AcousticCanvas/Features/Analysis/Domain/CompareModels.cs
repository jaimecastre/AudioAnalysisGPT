namespace AcousticCanvas.Features.Analysis.Domain;

public sealed class CompareSoundQuality
{
    public required double LoudnessSone { get; init; }
    public required double SharpnessAcum { get; init; }
    public required double RoughnessAsper { get; init; }
    public required string Method { get; init; }
}

public sealed class CompareSoundQualityDelta
{
    public required double LoudnessDeltaSone { get; init; }
    public required double SharpnessDeltaAcum { get; init; }
    public required double RoughnessDeltaAsper { get; init; }
    public required string LouderFileId { get; init; }
    public required string SharperFileId { get; init; }
    public required string RougherFileId { get; init; }
}

public sealed class CompareSpectrumCurve
{
    // Parallel arrays: frequenciesHz[k] corresponds to magnitudesDb[k].
    // Length is (fftSize / 2) + 1. MagnitudesDb values may be null for bins with zero energy.
    public required IReadOnlyList<double> FrequenciesHz { get; init; }
    public required IReadOnlyList<double?> MagnitudesDb { get; init; }
    public required int FftSize { get; init; }
    public required double Overlap { get; init; }
}

public sealed class CompareSpectrumDelta
{
    // B minus A in dB at each frequency bin. Computed by the backend so the frontend never does math.
    // null where either A or B has a null magnitude at that bin.
    public required IReadOnlyList<double> FrequenciesHz { get; init; }
    public required IReadOnlyList<double?> DeltaDb { get; init; }
}

public sealed class CompareBandEnergy
{
    public required string BandName { get; init; }
    public required double LowHz { get; init; }
    public required double HighHz { get; init; }
    public required double EnergyDb { get; init; }
}

public sealed class CompareCpbBand
{
    public required string Label { get; init; }
    public required double CenterFrequencyHz { get; init; }
    public required double LowerFrequencyHz { get; init; }
    public required double UpperFrequencyHz { get; init; }
    public required double? LevelDb { get; init; }
    public required string Weighting { get; init; }
    public required string WeightingMethod { get; init; }
}

public sealed class CompareFileSummary
{
    public required string FileId { get; init; }
    public required string FileName { get; init; }
    public required double PeakDb { get; init; }
    public required double RmsDb { get; init; }
    public required double CrestFactorDb { get; init; }
    public required double PeakFrequencyHz { get; init; }
    public required double PeakFrequencyMagnitudeDb { get; init; }
    public required double RegionStartSeconds { get; init; }
    public required double RegionEndSeconds { get; init; }

    // Full spectrum curve for this file — used by the frontend overlay canvas.
    public required CompareSpectrumCurve SpectrumCurve { get; init; }

    // Energy per named frequency band.
    public required IReadOnlyList<CompareBandEnergy> BandEnergies { get; init; }

    // Nominal 1/3 octave CPB bands for A/B diagnostic comparison.
    public required IReadOnlyList<CompareCpbBand> CpbBands { get; init; }

    // Psychoacoustic metrics (null if Python sidecar unavailable).
    public CompareSoundQuality? SoundQuality { get; init; }

    // Explicit reason when psychoacoustic metrics are unavailable for this file.
    public string? SoundQualityUnavailableReason { get; init; }

    // Unit string for dB level values (e.g. "dB SPL").
    public string? DbUnit { get; init; }
}

public sealed class PairwiseDiff
{
    public required string FileIdA { get; init; }
    public required string FileIdB { get; init; }
    public required double PeakDeltaDb { get; init; }
    public required string HigherPeakFileId { get; init; }
    public required double RmsDeltaDb { get; init; }
    public required string HigherRmsFileId { get; init; }
    public required double CrestFactorDeltaDb { get; init; }
    public required string HigherCrestFactorFileId { get; init; }
    public required double PeakFrequencyDeltaHz { get; init; }
    public required string HigherPeakFrequencyFileId { get; init; }

    // Precomputed B-A delta curve for the spectrum overlay — no frontend math needed.
    public required CompareSpectrumDelta SpectrumDelta { get; init; }

    // Per-band delta: B minus A in dB for each named band.
    public required IReadOnlyList<CompareBandEnergy> BandEnergyDeltas { get; init; }

    // Per-CPB-band delta: B minus A in dB for each nominal 1/3 octave band.
    public required IReadOnlyList<CompareCpbBand> CpbBandDeltas { get; init; }

    // Psychoacoustic delta (null if either file's SoundQuality is null).
    public CompareSoundQualityDelta? SoundQualityDelta { get; init; }

    // Explicit reason when psychoacoustic deltas are unavailable for this pair.
    public string? SoundQualityUnavailableReason { get; init; }
}

public sealed class CompareResult
{
    public required IReadOnlyList<CompareFileSummary> Files { get; init; }
    public required IReadOnlyList<PairwiseDiff> PairwiseDiffs { get; init; }
    public required DateTimeOffset RanAt { get; init; }
}
