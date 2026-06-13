// ─── Legacy columnar format (kept for agent tools and findings) ─────────

export type SpectrumParameters = {
  fftSize: number;
  windowType: 'hann' | 'rectangular';
  overlap: number;
  averaging: string;
  scaling: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  blockCount: number;
};

export type ChannelSpectrumAnalysis = {
  channelId: string;
  channelName: string;
  quantity: string;
  unit: string;
  // Columnar arrays: much smaller than array-of-objects in JSON
  frequenciesHz: number[];
  magnitudes: number[];
  magnitudesDb: (number | null)[];
  maxMagnitude: number | null;
  maxMagnitudeDb: number | null;
  peakFrequencyHz: number | null;
  tonalPeaks: TonalPeak[];
  dbUnit: string | null;
  dbReferenceValue: number | null;
  dbReferenceUnit: string | null;
  // Acoustic calibration metadata from backend.
  // 'Level [dB re 20 µPa]' or '[dBFS]'
  yAxisLabel: string | null;
  // 'digital_full_scale' | 'pressure_signal' | 'calibrated' | 'assumed_pressure'
  calibrationState: string | null;
  // 'Sound pressure' or 'Digital amplitude'
  physicalQuantity: string | null;
};

export type TonalPeak = {
  frequencyHz: number;
  magnitudeDb: number;
  localFloorDb: number;
  prominenceDb: number;
  bandwidthHz: number;
  confidence: 'medium' | 'high';
  method: string;
};

export type SpectrumAnalysis = {
  region: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
  parameters: SpectrumParameters;
  channels: ChannelSpectrumAnalysis[];
};

// ─── MessagePack [x, y] point format (frontend spectrum display) ───────

export type SpectrumPointsParameters = {
  fftSize: number;
  windowType: string;
  overlap: number;
  averaging: string;
  scaling: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  blockCount: number;
};

export type SpectrumPointsRegion = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export type SpectrumChannelPoints = {
  channelId: string;
  channelName: string;
  // [x, y] pairs where x = frequencyHz and y = magnitudeDb (or linear magnitude)
  points: number[][];
  yUnit: string;
  yAxisLabel: string;
  calibrationState: string;
  maxMagnitudeDb: number | null;
  peakFrequencyHz: number | null;
  dbReferenceValue: number | null;
  dbReferenceUnit: string | null;
  physicalQuantity: string | null;
  tonalPeaks: TonalPeak[];
};

export type SpectrumPointsResponse = {
  parameters: SpectrumPointsParameters;
  region: SpectrumPointsRegion;
  channels: SpectrumChannelPoints[];
};

// ─── User-facing parameters ──────────────────────────────────────────────

export type SpectrumUserParameters = {
  fftSize: number;
  windowType: 'hann' | 'rectangular';
  overlap: number;
  format: 'json' | 'msgpack';
  minFrequencyHz: number | null;
  maxFrequencyHz: number | null;
};

export const DEFAULT_SPECTRUM_PARAMS: SpectrumUserParameters = {
  fftSize: 8192,
  windowType: 'hann',
  overlap: 0.677,
  format: 'msgpack',
  minFrequencyHz: null,
  maxFrequencyHz: null,
};

export const FFT_SIZE_OPTIONS = [
  { value: '1024', label: '1024' },
  { value: '2048', label: '2048' },
  { value: '4096', label: '4096' },
  { value: '8192', label: '8192' },
  { value: '16384', label: '16384' },
] as const;
