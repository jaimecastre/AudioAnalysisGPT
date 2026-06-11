export type DbReference = {
  value: number;
  unit: string;
  dbUnit: string;
};

export type CalibrationInfo = {
  isCalibrated: boolean;
  scale: number;
  offset: number;
  source?: string | null;
  notes?: string | null;
};

export type FileInfoAnalysis = {
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  containerFormat: string;
  encodingFormat?: string | null;
  durationSeconds: number;
  sampleRate?: number | null;
  channelCount: number;
  bitDepth?: number | null;
  totalFrames?: number | null;
  totalSamples?: number | null;
};

export type ChannelLevelAnalysis = {
  channelId: string;
  channelName: string;
  quantity: string;
  unit: string;

  min: number;
  max: number;
  peak: number;
  rms: number;
  dcOffset: number;

  peakDb: number | null;
  rmsDb: number | null;
  dbUnit: string | null;
  dbReferenceValue: number | null;
  dbReferenceUnit: string | null;

  crestFactor: number | null;
  crestFactorDb: number | null;

  isCalibrated: boolean;
};

export type LevelAnalysis = {
  channels: ChannelLevelAnalysis[];
  combined: ChannelLevelAnalysis | null;
};

export type AnalysisResult = {
  fileInfo: FileInfoAnalysis;
  level: LevelAnalysis;
  analyzedAt: string;
};
