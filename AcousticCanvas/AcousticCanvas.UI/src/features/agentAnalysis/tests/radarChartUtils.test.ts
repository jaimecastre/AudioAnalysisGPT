import { describe, it, expect } from 'vitest';
import { buildRadarChartInput } from '../utils/radarChartUtils';
import type { SoundQualitySignal } from '../services/agentAskService';

const makeSignal = (
  fileName: string,
  loudnessSone: number,
  sharpnessAcum: number,
  roughnessAsper: number
): SoundQualitySignal => ({
  fileId: `id_${fileName}`,
  fileName,
  loudnessSone,
  sharpnessAcum,
  roughnessAsper,
});

describe('buildRadarChartInput', () => {
  it('produces one data row per metric axis', () => {
    const signals = [makeSignal('a.wav', 20, 1.5, 0.02), makeSignal('b.wav', 15, 1.7, 0.03)];
    const { data } = buildRadarChartInput(signals);
    expect(data).toHaveLength(3);
    const keys = data.map((row) => row['metric']);
    expect(keys).toContain('Loudness');
    expect(keys).toContain('Sharpness');
    expect(keys).toContain('Roughness');
  });

  it('normalizes values 0–100 relative to max per metric', () => {
    const signals = [makeSignal('a.wav', 20, 1.5, 0.02), makeSignal('b.wav', 10, 1.5, 0.04)];
    const { data } = buildRadarChartInput(signals);
    const loudnessRow = data.find((r) => r['metric'] === 'Loudness')!;
    expect(loudnessRow['a.wav']).toBe(100); // 20/20 * 100
    expect(loudnessRow['b.wav']).toBe(50);  // 10/20 * 100
    const roughnessRow = data.find((r) => r['metric'] === 'Roughness')!;
    expect(roughnessRow['a.wav']).toBe(50);  // 0.02/0.04 * 100
    expect(roughnessRow['b.wav']).toBe(100); // 0.04/0.04 * 100
  });

  it('produces one series entry per signal with unique color', () => {
    const signals = [makeSignal('a.wav', 20, 1.5, 0.02), makeSignal('b.wav', 15, 1.7, 0.03)];
    const { series } = buildRadarChartInput(signals);
    expect(series).toHaveLength(2);
    expect(series[0].name).toBe('a.wav');
    expect(series[1].name).toBe('b.wav');
    expect(series[0].color).not.toBe(series[1].color);
  });

  it('uses fileName as the series name', () => {
    const signals = [makeSignal('test-file.wav', 20, 1.5, 0.02)];
    const { series } = buildRadarChartInput(signals);
    expect(series[0].name).toBe('test-file.wav');
  });

  it('handles all-zero metric values without division by zero', () => {
    const signals = [makeSignal('a.wav', 0, 1.5, 0.02), makeSignal('b.wav', 0, 1.5, 0.02)];
    const { data } = buildRadarChartInput(signals);
    const loudnessRow = data.find((r) => r['metric'] === 'Loudness')!;
    expect(loudnessRow['a.wav']).toBe(0);
    expect(loudnessRow['b.wav']).toBe(0);
  });

  it('data row values are numeric (not NaN or Infinity)', () => {
    const signals = [makeSignal('a.wav', 5, 2.0, 0.1), makeSignal('b.wav', 10, 1.0, 0.05)];
    const { data } = buildRadarChartInput(signals);
    for (const row of data) {
      for (const [key, val] of Object.entries(row)) {
        if (key === 'metric') continue;
        expect(typeof val).toBe('number');
        expect(Number.isFinite(val as number)).toBe(true);
      }
    }
  });
});
