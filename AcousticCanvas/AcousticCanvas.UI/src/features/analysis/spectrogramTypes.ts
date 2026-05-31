export type SpectrogramParameters = {
  fftSize: number;
  windowType: string;
  overlap: number;
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
  // [frameIndex][binIndex] = byte 0-255 — matches wavesurfer SpectrogramPlugin Uint8Array[][] shape
  frequencyData: number[][];
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
};

export const DEFAULT_SPECTROGRAM_PARAMS: SpectrogramUserParameters = {
  fftSize: 2048,
  overlap: 0.75,
};
