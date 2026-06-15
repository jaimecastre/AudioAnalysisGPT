export type BatchBenchmarkRequest = {
  fileIds: string[];
  startSeconds: number | null;
  endSeconds: number | null;
};

export type BatchBenchmarkFindingSummary = {
  findingId: string;
  type: string;
  severity: string;
  title: string;
  startSeconds: number | null;
  endSeconds: number | null;
  frequencyHz: number | null;
};

export type BatchBenchmarkFileRow = {
  fileId: string;
  fileName: string;
  regionStartSeconds: number;
  regionEndSeconds: number;
  rmsDb: number;
  peakDb: number;
  crestFactorDb: number;
  peakFrequencyHz: number;
  peakFrequencyMagnitudeDb: number;
  findingCount: number;
  highSeverityFindingCount: number;
  mediumSeverityFindingCount: number;
  strongestTonalPeakFrequencyHz: number | null;
  strongestTonalPeakProminenceDb: number | null;
  loudnessSone: number | null;
  sharpnessAcum: number | null;
  roughnessAsper: number | null;
  soundQualityUnavailableReason: string | null;
  flagLabels: string[];
  topFindings: BatchBenchmarkFindingSummary[];
  dbUnit?: string;
};

export type BatchBenchmarkRanking = {
  metric: string;
  label: string;
  direction: string;
  fileIds: string[];
};

export type BatchBenchmarkOutlier = {
  fileId: string;
  metric: string;
  label: string;
  direction: string;
  value: number;
  lowerFence: number;
  upperFence: number;
};

export type BatchBenchmarkResult = {
  files: BatchBenchmarkFileRow[];
  rankings: BatchBenchmarkRanking[];
  outliers: BatchBenchmarkOutlier[];
  limitations: string[];
  ranAt: string;
};
