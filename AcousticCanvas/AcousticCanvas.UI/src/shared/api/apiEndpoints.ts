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
    RUN_CPB: 'api/analysis/cpb',
    RUN_SOUND_QUALITY: 'api/analysis/sound-quality',
    METRIC_RANKING: 'api/analysis/metric-ranking',
    SOUND_QUALITY_SUMMARY: 'api/analysis/sound-quality-summary',
    RUN_AGENT_ANALYSIS: 'api/analysis/run',
    RUN_COMPARE: 'api/analysis/compare',
    RUN_BATCH_BENCHMARK: 'api/analysis/batch-benchmark',
    RUN_FIND: 'api/analysis/find',
    RUN_FINDINGS: 'api/analysis/findings',
    GENERATE_REPORT: 'api/analysis/report',
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
