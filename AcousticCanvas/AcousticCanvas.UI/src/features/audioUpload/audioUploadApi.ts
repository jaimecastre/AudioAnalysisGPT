export interface AudioFileResponse {
  id: string;
  name: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface WaveformResponse {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  globalMinFs: number;
  globalMaxFs: number;
  peaks: number[];
}
