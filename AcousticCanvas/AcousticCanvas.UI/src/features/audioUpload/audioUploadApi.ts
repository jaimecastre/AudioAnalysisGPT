export interface WaveformBin {
  x: number;
  yMin: number;
  yMax: number;
}

export interface AudioFileResponse {
  id: string;
  name: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  waveformBins: WaveformBin[];
}
