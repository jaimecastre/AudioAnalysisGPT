import { describe, expect, it } from 'vitest';
import { createToolResultArtifactDrafts } from './agentToolArtifacts';

describe('createToolResultArtifactDrafts', () => {
  it('splits multi-file spectrogram output into one artifact draft per file', () => {
    const drafts = createToolResultArtifactDrafts('run_spectrogram', {
      results: [
        {
          fileId: 'file-a',
          region: { startSeconds: 0, endSeconds: 2.5 },
          parameters: { fftSize: 2048, scale: 'mel' },
          summary: { frameCount: 215, binCount: 1025, nyquistHz: 22050 },
        },
        {
          fileId: 'file-b',
          region: { startSeconds: 0, endSeconds: 1.6 },
          parameters: { fftSize: 2048, scale: 'mel' },
          summary: { frameCount: 135, binCount: 1025, nyquistHz: 22050 },
        },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_spectrogram',
      fileId: 'file-a',
      rows: [
        { label: 'region', value: '0.000s - 2.500s' },
        { label: 'scale', value: 'mel' },
        { label: 'FFT size', value: '2048' },
        { label: 'frames', value: '215' },
        { label: 'bins', value: '1025' },
        { label: 'Nyquist', value: '22050 Hz' },
      ],
    });
    expect(drafts[1]?.fileId).toBe('file-b');
  });

  it('keeps non-spectrogram tool output as a single artifact draft', () => {
    const drafts = createToolResultArtifactDrafts('run_spectrum', {
      results: [
        {
          fileId: 'file-a',
          summary: {
            peakFrequencyHz: 1000,
            maxMagnitudeDb: -12.5,
          },
        },
      ],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_spectrum',
      rows: [
        { label: 'peak frequency', value: '1000 Hz' },
        { label: 'max magnitude', value: '-12.50 dBFS' },
      ],
    });
  });
});
