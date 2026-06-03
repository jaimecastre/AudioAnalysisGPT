export type CpbBandMode = 'octave' | 'third_octave';

export type CpbParameters = {
  bandMode: CpbBandMode;
  bandsPerOctave: number;
  fftSize: number;
  windowType: string;
  overlap: number;
  averaging: string;
  scaling: string;
  method: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  blockCount: number;
  sampleRate: number;
};

export type CpbBand = {
  label: string;
  centerFrequencyHz: number;
  lowerFrequencyHz: number;
  upperFrequencyHz: number;
  magnitude: number;
  levelDb: number | null;
  binCount: number;
};

export type ChannelCpbAnalysis = {
  channelId: string;
  channelName: string;
  quantity: string;
  unit: string;
  dbUnit: string | null;
  bands: CpbBand[];
};

export type CpbAnalysis = {
  parameters: CpbParameters;
  region: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
  channels: ChannelCpbAnalysis[];
};

export type CpbUserParameters = {
  bandMode: CpbBandMode;
  fftSize: number;
  overlap: number;
};

export const DEFAULT_CPB_PARAMS: CpbUserParameters = {
  bandMode: 'third_octave',
  fftSize: 8192,
  overlap: 0.5,
};

export const CPB_BAND_MODE_OPTIONS = [
  { value: 'third_octave', label: '1/3 oct' },
  { value: 'octave', label: 'Octave' },
] as const;

export const CPB_FFT_SIZE_OPTIONS = [
  { value: '4096', label: '4096' },
  { value: '8192', label: '8192' },
  { value: '16384', label: '16384' },
] as const;
