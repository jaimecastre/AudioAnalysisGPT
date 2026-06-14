import type { AgentCapability, AnalysisKindEntry, EventKindEntry, CapabilityRegistry } from '../types/agentToolTypes';

const AGENT_TOOLS: AgentCapability[] = [
  {
    tool: 'getState',
    description: 'Returns a snapshot of the current workspace: active file, selection, visible views, and available tools.',
  },
  {
    tool: 'analyze',
    description: 'Runs a named analysis (e.g. level, spectrum, spectrogram) on the active file or a selected region and returns the result.',
  },
  {
    tool: 'compare',
    description: 'Compares analysis results from two files or two regions and returns a structured diff.',
  },
  {
    tool: 'find',
    description: 'Searches the audio for events such as clipping, silence, loudest region, or click artifacts.',
  },
  {
    tool: 'workspace',
    description: 'Updates the workspace: adds markers, opens or closes views, or sets the active selection.',
  },
  {
    tool: 'report',
    description: 'Generates a markdown report summarising all analysis results and findings in the current session.',
  },
];

const ANALYSIS_KINDS: AnalysisKindEntry[] = [
  {
    kind: 'file_info',
    description: 'Returns metadata about the audio file: format, duration, sample rate, channel count, bit depth, and file size.',
    requiresRegion: false,
    defaultOptions: {},
  },
  {
    kind: 'level',
    description: 'Computes amplitude statistics per channel: peak, RMS, crest factor, DC offset, and dBFS levels.',
    requiresRegion: false,
    defaultOptions: {},
  },
  {
    kind: 'spectrum',
    description: 'Computes a frequency-domain spectrum (FFT) over a time region, returning peak frequency and magnitude per channel.',
    requiresRegion: true,
    defaultOptions: {
      fftSize: 44100,
      windowType: 'hann' as const,
      overlap: 0.677,
    },
  },
  {
    kind: 'spectrogram',
    description: 'Computes a full-file time-frequency spectrogram summary for agent evidence.',
    requiresRegion: false,
    defaultOptions: {
      backendTool: 'run_spectrogram',
      fftSize: 44100,
      overlap: 0.75,
      scale: 'mel',
    },
  },
  {
    kind: 'sound_quality',
    description: 'Computes MoSQITo loudness, sharpness, and roughness over the full file.',
    requiresRegion: false,
    defaultOptions: {
      backendTool: 'run_sound_quality_metrics',
    },
  },
  {
    kind: 'loudness',
    description: 'Semantic loudness analysis mode mapped to measured level metrics such as RMS and peak values.',
    requiresRegion: false,
    defaultOptions: {
      backendKind: 'level',
    },
  },
  {
    kind: 'peaks',
    description: 'Semantic peak-focused analysis mode mapped to measured level metrics.',
    requiresRegion: false,
    defaultOptions: {
      backendKind: 'level',
    },
  },
  {
    kind: 'dynamics',
    description: 'Semantic dynamics mode mapped to crest factor, RMS, and peak analysis.',
    requiresRegion: false,
    defaultOptions: {
      backendKind: 'level',
    },
  },
  {
    kind: 'spectral_balance',
    description: 'Semantic spectrum mode for tonal balance issues such as muddy, harsh, or boomy content.',
    requiresRegion: true,
    defaultOptions: {
      backendKind: 'spectrum',
      focus: 'general',
    },
  },
  {
    kind: 'noise',
    description: 'Semantic noise-inspection mode mapped to spectral analysis for frequency-domain evidence.',
    requiresRegion: true,
    defaultOptions: {
      backendKind: 'spectrum',
    },
  },
  {
    kind: 'stereo_phase',
    description: 'Semantic stereo/phase inspection mode currently mapped to level-domain indicators.',
    requiresRegion: false,
    defaultOptions: {
      backendKind: 'level',
    },
  },
  {
    kind: 'distortion',
    description: 'Semantic distortion mode currently mapped to level-domain clipping/peak indicators.',
    requiresRegion: false,
    defaultOptions: {
      backendKind: 'level',
    },
  },
  {
    kind: 'dialogue_clarity',
    description: 'Semantic dialogue-clarity mode mapped to spectral analysis for masking and tonal evidence.',
    requiresRegion: true,
    defaultOptions: {
      backendKind: 'spectrum',
    },
  },
];

const EVENT_KINDS: EventKindEntry[] = [
  {
    kind: 'clipping',
    description: 'Detects samples that have reached or exceeded full scale (|amplitude| >= 1.0), indicating digital clipping.',
    defaultOptions: {
      thresholdLinear: 1.0,
    },
  },
  {
    kind: 'silence',
    description: 'Finds regions where the RMS level falls below a threshold, indicating silence or very low-level content.',
    defaultOptions: {
      thresholdDb: -60,
      minDurationSeconds: 0.1,
    },
  },
  {
    kind: 'loudest',
    description: 'Locates the time window with the highest RMS energy in the file.',
    defaultOptions: {
      windowSeconds: 1.0,
    },
  },
  {
    kind: 'transient',
    description: 'Detects sudden onsets and transient regions in the waveform.',
    defaultOptions: {
      onsetThresholdDb: 12,
    },
  },
];

export const CAPABILITY_REGISTRY: CapabilityRegistry = {
  tools: AGENT_TOOLS,
  analysisKinds: ANALYSIS_KINDS,
  eventKinds: EVENT_KINDS,
};

export const SUPPORTED_ANALYSIS_KINDS: string[] = ANALYSIS_KINDS.map((entry) => entry.kind);
export const SUPPORTED_EVENT_KINDS: string[] = EVENT_KINDS.map((entry) => entry.kind);

export function isAnalysisKindSupported(kind: string): boolean {
  return SUPPORTED_ANALYSIS_KINDS.includes(kind);
}

export function isEventKindSupported(kind: string): boolean {
  return SUPPORTED_EVENT_KINDS.includes(kind);
}

export function buildUnsupportedAnalysisKindError(kind: string): string {
  return `Analysis kind "${kind}" is not supported. Supported kinds: ${SUPPORTED_ANALYSIS_KINDS.join(', ')}.`;
}

export function buildUnsupportedEventKindError(kind: string): string {
  return `Event kind "${kind}" is not supported. Supported kinds: ${SUPPORTED_EVENT_KINDS.join(', ')}.`;
}
