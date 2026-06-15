export type SpectrogramAxisTick = {
  positionPercent: number;
  label: string;
};

export type SpectrogramParameters = {
  fftSize: number;
  windowType: string;
  overlap: number;
  scale: SpectrogramScale;
  gainDb: number;
  rangeDb: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  frameCount: number;
  binCount: number;
  sampleRate: number;
  // SPL display range — only meaningful for pressure-calibrated channels
  minDbSpl: number;
  maxDbSpl: number;
};

export type ChannelSpectrogramAnalysis = {
  channelId: string;
  channelName: string;
  binCount: number;
  frameCount: number;
  nyquistHz: number;
  // Each backend byte[] frame is serialized by System.Text.Json as a base64 string.
  frequencyData: string[];
  // Acoustic calibration metadata from backend.
  // 'pressure_signal' | 'calibrated' | 'assumed_pressure'
  calibrationState: string | null;
  // Always 'dB SPL' (0 dBFS = 91 dB SPL, 1 FS = 1 Pa peak)
  colorbandLabel: string | null;
};

export type SpectrogramAnalysis = {
  parameters: SpectrogramParameters;
  region: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
  channels: ChannelSpectrogramAnalysis[];
  timeAxisTicks: SpectrogramAxisTick[];
  frequencyAxisTicks: SpectrogramAxisTick[];
};

export type SpectrogramUserParameters = {
  fftSize: number;
  overlap: number;
  scale: SpectrogramScale;
  gainDb: number;
  rangeDb: number;
  minDbSpl: number;
  maxDbSpl: number;
};

export type SpectrogramScale = 'mel' | 'linear' | 'logarithmic';

export const DEFAULT_SPECTROGRAM_PARAMS: SpectrogramUserParameters = {
  fftSize: 44100,
  overlap: 0.75,
  scale: 'mel',
  gainDb: 20,
  rangeDb: 80,
  // BK Connect-style default: –68 to +55 dB SPL.
  // With 1 FS = 1 Pa convention, 0 dBFS ≈ 91 dB SPL.
  minDbSpl: -68,
  maxDbSpl: 55,
};

export const SPECTROGRAM_FFT_SIZE_OPTIONS = [
  { value: '512',  label: '256 lines' },
  { value: '1024', label: '512 lines' },
  { value: '2048', label: '1024 lines' },
  { value: '4096', label: '2048 lines' },
  { value: '8192', label: '4096 lines' },
  { value: '44100', label: '22050 lines' },
] as const;

export const SPECTROGRAM_SCALE_OPTIONS = [
  { value: 'mel', label: 'Mel' },
  { value: 'linear', label: 'Linear' },
  { value: 'logarithmic', label: 'Log' },
] as const;

export const SPECTROGRAM_RANGE_OPTIONS = [
  { value: '60', label: '60 dB' },
  { value: '80', label: '80 dB' },
  { value: '100', label: '100 dB' },
] as const;

export const SPECTROGRAM_GAIN_OPTIONS = [
  { value: '-10', label: '-10 dB' },
  { value: '0', label: '0 dB' },
  { value: '10', label: '+10 dB' },
  { value: '20', label: '+20 dB' },
  { value: '30', label: '+30 dB' },
] as const;
