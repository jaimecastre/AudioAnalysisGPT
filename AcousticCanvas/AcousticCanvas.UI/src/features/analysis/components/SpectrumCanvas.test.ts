import { describe, expect, it } from 'vitest';
import { chooseSpectrumYAxisStep } from './spectrumYAxis';

describe('SpectrumCanvas', () => {
  it('uses wider y-axis tick spacing when the plot area is compact', () => {
    const compactStep = chooseSpectrumYAxisStep(-120, 20, 70);
    const fullSizeStep = chooseSpectrumYAxisStep(-120, 20, 244);

    expect(compactStep).toBeGreaterThan(10);
    expect(fullSizeStep).toBe(10);
  });
});
