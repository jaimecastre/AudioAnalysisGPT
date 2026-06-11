import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_REGISTRY,
  SUPPORTED_ANALYSIS_KINDS,
  SUPPORTED_EVENT_KINDS,
  isAnalysisKindSupported,
  isEventKindSupported,
  buildUnsupportedAnalysisKindError,
  buildUnsupportedEventKindError,
} from '../utils/capabilitiesRegistry';

describe('CAPABILITY_REGISTRY structure', () => {
  it('contains 6 agent tools', () => {
    expect(CAPABILITY_REGISTRY.tools).toHaveLength(6);
  });

  it('contains expanded analysis kinds including semantic modes', () => {
    expect(CAPABILITY_REGISTRY.analysisKinds.length).toBeGreaterThanOrEqual(11);
  });

  it('contains 4 event kinds', () => {
    expect(CAPABILITY_REGISTRY.eventKinds).toHaveLength(4);
  });

  it('each analysis kind has kind, description, requiresRegion, and defaultOptions', () => {
    for (const entry of CAPABILITY_REGISTRY.analysisKinds) {
      expect(entry).toHaveProperty('kind');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('requiresRegion');
      expect(entry).toHaveProperty('defaultOptions');
    }
  });

  it('each event kind has kind, description, and defaultOptions', () => {
    for (const entry of CAPABILITY_REGISTRY.eventKinds) {
      expect(entry).toHaveProperty('kind');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('defaultOptions');
    }
  });

  it('spectrum analysis kind requires a region', () => {
    const spectrumEntry = CAPABILITY_REGISTRY.analysisKinds.find((e) => e.kind === 'spectrum');
    expect(spectrumEntry?.requiresRegion).toBe(true);
  });

  it('file_info and level do not require a region', () => {
    const fileInfo = CAPABILITY_REGISTRY.analysisKinds.find((e) => e.kind === 'file_info');
    const level = CAPABILITY_REGISTRY.analysisKinds.find((e) => e.kind === 'level');
    expect(fileInfo?.requiresRegion).toBe(false);
    expect(level?.requiresRegion).toBe(false);
  });

  it('includes full-file sound quality metrics', () => {
    const soundQuality = CAPABILITY_REGISTRY.analysisKinds.find((e) => e.kind === 'sound_quality');
    expect(soundQuality?.requiresRegion).toBe(false);
    expect(soundQuality?.description).toContain('loudness');
    expect(soundQuality?.description).toContain('roughness');
  });

  it('includes full-file spectrogram analysis for the backend agent', () => {
    const spectrogram = CAPABILITY_REGISTRY.analysisKinds.find((e) => e.kind === 'spectrogram');
    expect(spectrogram?.requiresRegion).toBe(false);
    expect(spectrogram?.description).toContain('time-frequency');
    expect(spectrogram?.defaultOptions.backendTool).toBe('run_spectrogram');
  });
});

describe('isAnalysisKindSupported', () => {
  it('returns true for supported kinds', () => {
    expect(isAnalysisKindSupported('file_info')).toBe(true);
    expect(isAnalysisKindSupported('level')).toBe(true);
    expect(isAnalysisKindSupported('spectrum')).toBe(true);
    expect(isAnalysisKindSupported('spectrogram')).toBe(true);
    expect(isAnalysisKindSupported('sound_quality')).toBe(true);
    expect(isAnalysisKindSupported('loudness')).toBe(true);
    expect(isAnalysisKindSupported('spectral_balance')).toBe(true);
    expect(isAnalysisKindSupported('dialogue_clarity')).toBe(true);
  });

  it('returns false for unsupported kinds', () => {
    expect(isAnalysisKindSupported('transient')).toBe(false);
    expect(isAnalysisKindSupported('')).toBe(false);
    expect(isAnalysisKindSupported('LEVEL')).toBe(false);
  });
});

describe('isEventKindSupported', () => {
  it('returns true for supported kinds', () => {
    expect(isEventKindSupported('clipping')).toBe(true);
    expect(isEventKindSupported('silence')).toBe(true);
    expect(isEventKindSupported('loudest')).toBe(true);
    expect(isEventKindSupported('transient')).toBe(true);
  });

  it('returns false for unsupported kinds', () => {
    expect(isEventKindSupported('noise')).toBe(false);
    expect(isEventKindSupported('')).toBe(false);
  });
});

describe('error message builders', () => {
  it('buildUnsupportedAnalysisKindError lists all supported kinds', () => {
    const errorMessage = buildUnsupportedAnalysisKindError('loudness');
    expect(errorMessage).toContain('loudness');
    for (const kind of SUPPORTED_ANALYSIS_KINDS) {
      expect(errorMessage).toContain(kind);
    }
  });

  it('buildUnsupportedEventKindError lists all supported kinds', () => {
    const errorMessage = buildUnsupportedEventKindError('noise');
    expect(errorMessage).toContain('noise');
    for (const kind of SUPPORTED_EVENT_KINDS) {
      expect(errorMessage).toContain(kind);
    }
  });
});
