import { describe, it, expect } from 'vitest';
import { getStateTool, getStateToolAsJson } from './getStateTool';
import type { RootState } from '../../../store/reduxStore';

const emptyState: RootState = {
  project: {
    projectName: 'Untitled Project',
    status: 'no-project',
    files: [],
    selectedSignalId: null,
    markers: [],
    visibleViews: ['waveform'],
  },
  navigation: {
    activeMode: 'manual',
    activeFileId: null,
    activeView: 'home',
  },
  waveformSelection: {
    activeSelection: null,
    loopEnabled: false,
  },
  analysis: {
    result: null,
    status: 'idle',
    error: null,
  },
  spectrum: {
    result: null,
    status: 'idle',
    error: null,
    activeRequestId: null,
    selectedChannelId: null,
    userParameters: { fftSize: 2048, windowType: 'hann', overlap: 0.5 },
  },
  spectrogram: {
    result: null,
    status: 'idle',
    error: null,
    activeRequestId: null,
    selectedChannelId: null,
    userParameters: { fftSize: 1024, overlap: 0.75, scale: 'linear', rangeDb: 80, gainDb: 0 },
  },
};

const stateWithFile: RootState = {
  ...emptyState,
  project: {
    projectName: 'Test Project',
    status: 'ready',
    files: [
      {
        id: 'file-001',
        name: 'kick_drum.wav',
        durationSeconds: 2.5,
        sampleRate: 44100,
        channels: 1,
        bitDepth: 24,
        fileSizeBytes: 220500,
      },
    ],
    selectedSignalId: 'file-001',
    markers: [],
    visibleViews: ['waveform'],
  },
};

const stateWithFileAndSelection: RootState = {
  ...stateWithFile,
  waveformSelection: {
    activeSelection: {
      id: 'sel-001',
      startSeconds: 0.5,
      endSeconds: 1.5,
    },
    loopEnabled: false,
  },
};

describe('getStateTool', () => {
  it('returns null activeFile when no file is loaded', () => {
    const result = getStateTool(emptyState);
    expect(result.activeFile).toBeNull();
  });

  it('returns null activeSelection when nothing is selected', () => {
    const result = getStateTool(emptyState);
    expect(result.activeSelection).toBeNull();
  });

  it('returns correct project name and status', () => {
    const result = getStateTool(emptyState);
    expect(result.projectName).toBe('Untitled Project');
    expect(result.projectStatus).toBe('no-project');
  });

  it('returns active file metadata when a file is loaded', () => {
    const result = getStateTool(stateWithFile);
    expect(result.activeFile).not.toBeNull();
    expect(result.activeFile?.id).toBe('file-001');
    expect(result.activeFile?.name).toBe('kick_drum.wav');
    expect(result.activeFile?.durationSeconds).toBe(2.5);
    expect(result.activeFile?.sampleRate).toBe(44100);
    expect(result.activeFile?.channels).toBe(1);
    expect(result.activeFile?.bitDepth).toBe(24);
  });

  it('returns active selection with computed duration when a region is selected', () => {
    const result = getStateTool(stateWithFileAndSelection);
    expect(result.activeSelection).not.toBeNull();
    expect(result.activeSelection?.startSeconds).toBe(0.5);
    expect(result.activeSelection?.endSeconds).toBe(1.5);
    expect(result.activeSelection?.durationSeconds).toBe(1.0);
  });

  it('lists waveform as a visible view when a file is loaded', () => {
    const result = getStateTool(stateWithFile);
    expect(result.visibleViews).toContain('waveform');
  });

  it('lists no visible views when no file is loaded', () => {
    const result = getStateTool(emptyState);
    expect(result.visibleViews).toHaveLength(0);
  });

  it('always returns the full capability registry', () => {
    const result = getStateTool(emptyState);
    expect(result.capabilities).toHaveProperty('tools');
    expect(result.capabilities).toHaveProperty('analysisKinds');
    expect(result.capabilities).toHaveProperty('eventKinds');
    expect(result.capabilities.tools).toHaveLength(6);
    expect(result.capabilities.analysisKinds).toHaveLength(3);
    expect(result.capabilities.eventKinds).toHaveLength(4);
  });

  it('does not include any raw audio buffer fields', () => {
    const result = getStateTool(stateWithFile);
    const jsonString = JSON.stringify(result);
    expect(jsonString).not.toContain('ArrayBuffer');
    expect(jsonString).not.toContain('Float32Array');
    expect(jsonString).not.toContain('Uint8Array');
    expect(jsonString).not.toContain('Int16Array');
  });

  it('serializes to valid JSON without throwing', () => {
    const jsonString = getStateToolAsJson(stateWithFileAndSelection);
    expect(() => JSON.parse(jsonString)).not.toThrow();
    const parsed = JSON.parse(jsonString);
    expect(parsed).toHaveProperty('projectName');
    expect(parsed).toHaveProperty('activeFile');
    expect(parsed).toHaveProperty('activeSelection');
    expect(parsed).toHaveProperty('visibleViews');
    expect(parsed).toHaveProperty('capabilities');
  });
});
