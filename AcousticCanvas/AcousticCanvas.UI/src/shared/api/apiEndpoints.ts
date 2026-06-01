export const API_ENDPOINTS = {
  AUDIO: {
    UPLOAD: 'api/audio/upload',
    PLAYBACK_CONTROL: 'api/audio/playback/control',
    GET_STATE: (fileId: string) => `api/audio/playback/state/${fileId}`,
    GET_FILE: (fileId: string) => `api/audio/file/${fileId}`,
    GET_WAVEFORM: (fileId: string, points: number) => `api/waveform?fileId=${fileId}&points=${points}`,
    RUN_ANALYSIS: (fileId: string) => `api/analysis?fileId=${fileId}`,
    RUN_SPECTRUM: 'api/analysis/spectrum',
    RUN_SPECTROGRAM: 'api/analysis/spectrogram',
    RUN_AGENT_ANALYSIS: 'api/analysis/run',
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
