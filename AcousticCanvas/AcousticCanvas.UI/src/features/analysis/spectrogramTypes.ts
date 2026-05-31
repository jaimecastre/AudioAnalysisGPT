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
};

export type ChannelSpectrogramAnalysis = {
  channelId: string;
  channelName: string;
  binCount: number;
  frameCount: number;
  nyquistHz: number;
  // Each backend byte[] frame is serialized by System.Text.Json as a base64 string.
  frequencyData: string[];
};

export type SpectrogramAnalysis = {
  parameters: SpectrogramParameters;
  region: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
  channels: ChannelSpectrogramAnalysis[];
};

export type SpectrogramUserParameters = {
  fftSize: number;
  overlap: number;
  scale: SpectrogramScale;
  gainDb: number;
  rangeDb: number;
};

export type SpectrogramScale = 'mel' | 'linear' | 'logarithmic';

export const DEFAULT_SPECTROGRAM_PARAMS: SpectrogramUserParameters = {
  fftSize: 2048,
  overlap: 0.75,
  scale: 'mel',
  gainDb: 20,
  rangeDb: 80,
};

export const SPECTROGRAM_FFT_SIZE_OPTIONS = [
  { value: '1024', label: '1024' },
  { value: '2048', label: '2048' },
  { value: '4096', label: '4096' },
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
