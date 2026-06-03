import { describe, expect, it } from 'vitest';
import { applyGroundingGuardrails } from './responseGuardrails';

describe('applyGroundingGuardrails', () => {
  it('keeps normal non-subjective text unchanged', () => {
    const text = 'The peak level is -1.2 dBFS and RMS is -20.4 dBFS.';
    const result = applyGroundingGuardrails(text, []);
    expect(result).toBe(text);
  });

  it('replaces unsupported subjective spectral claims when only peak metrics exist', () => {
    const text = 'The dialogue sounds boxy because the peak frequency is 37.68 Hz.';
    const toolOutputs = [
      {
        kind: 'spectrum',
        summary: {
          peakFrequencyHz: 37.68,
          peakMagnitudeDb: -39.4,
        },
      },
    ];

    const result = applyGroundingGuardrails(text, toolOutputs);
    expect(result).toContain('do not have enough band-energy evidence');
    expect(result).toContain('peak frequency 37.68 Hz');
  });

  it('allows subjective spectral language when band evidence is present', () => {
    const text = 'This region sounds muddy due to elevated low-mid energy.';
    const toolOutputs = [
      {
        kind: 'spectrum',
        summary: {
          lowMidBandEnergyDb: 5.2,
          maskingRisk: 'high',
        },
      },
    ];

    const result = applyGroundingGuardrails(text, toolOutputs);
    expect(result).toBe(text);
  });
});
