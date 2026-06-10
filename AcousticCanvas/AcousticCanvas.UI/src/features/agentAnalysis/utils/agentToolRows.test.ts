import { describe, expect, it } from 'vitest';
import { extractAgentToolRows } from './agentToolRows';

describe('extractAgentToolRows', () => {
  it('formats spectrogram tool output for compact workspace artifacts', () => {
    const rows = extractAgentToolRows('run_spectrogram', {
      results: [
        {
          fileId: 'file123456',
          region: {
            startSeconds: 0,
            endSeconds: 1.5,
            durationSeconds: 1.5,
          },
          parameters: {
            fftSize: 2048,
            scale: 'mel',
          },
          summary: {
            frameCount: 42,
            binCount: 1025,
            nyquistHz: 24000,
          },
        },
      ],
    });

    expect(rows).toEqual([
      { label: 'region', value: '0.000s - 1.500s' },
      { label: 'scale', value: 'mel' },
      { label: 'FFT size', value: '2048' },
      { label: 'frames', value: '42' },
      { label: 'bins', value: '1025' },
      { label: 'Nyquist', value: '24000 Hz' },
    ]);
  });
});
