import { describe, expect, it } from 'vitest';
import { mapAnalysisResultResponse } from './analysisResultMapping';

describe('mapAnalysisResultResponse', () => {
  it('maps spectrogram results without falling through to findings', () => {
    const spectrogramData = {
      parameters: {
        fftSize: 2048,
        windowType: 'Hann',
        overlap: 0.75,
        scale: 'mel',
        gainDb: 20,
        rangeDb: 80,
        startTimeSeconds: 0,
        endTimeSeconds: 1,
        frameCount: 10,
        binCount: 1025,
        sampleRate: 48000,
        minDbSpl: -68,
        maxDbSpl: 55,
      },
      region: {
        startSeconds: 0,
        endSeconds: 1,
        durationSeconds: 1,
      },
      channels: [],
      timeAxisTicks: [],
      frequencyAxisTicks: [],
    };

    const result = mapAnalysisResultResponse({ type: 'spectrogram', data: spectrogramData });

    expect(result.type).toBe('spectrogram');
    expect(result.data).toBe(spectrogramData);
  });
});
