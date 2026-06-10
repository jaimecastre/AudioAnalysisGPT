import { describe, expect, it } from 'vitest';
import { buildEvidenceRows, getEvidenceLabel } from './evidenceFormatting';

describe('evidenceFormatting', () => {
  it('formats basic metric evidence with dBFS and dB units', () => {
    const rows = buildEvidenceRows({
      evidenceId: 'ev_metrics_file_1',
      type: 'basic_metrics',
      data: {
        fileName: 'motor.wav',
        peakDbFs: -3.21,
        rmsDbFs: -18.456,
        crestFactorDb: 15.246,
      },
    });

    expect(getEvidenceLabel('basic_metrics')).toBe('Basic metrics');
    expect(rows).toEqual([
      { label: 'file', value: 'motor.wav' },
      { label: 'peak', value: '-3.21 dBFS' },
      { label: 'RMS', value: '-18.46 dBFS' },
      { label: 'crest factor', value: '15.25 dB' },
    ]);
  });

  it('formats spectrum evidence with Hz units', () => {
    const rows = buildEvidenceRows({
      evidenceId: 'ev_spectrum_file_1',
      type: 'spectrum',
      data: {
        peakFrequencyHz: 1000.4,
        maxMagnitudeDb: -6.234,
      },
    });

    expect(rows).toEqual([
      { label: 'peak frequency', value: '1000 Hz' },
      { label: 'max magnitude', value: '-6.23 dB' },
    ]);
  });

  it('formats spectrogram evidence with time-frequency metadata', () => {
    const rows = buildEvidenceRows({
      evidenceId: 'ev_spectrogram_file_1',
      type: 'spectrogram',
      data: {
        scale: 'mel',
        fftSize: 2048,
        frameCount: 42,
        binCount: 1025,
        nyquistHz: 24000,
      },
    });

    expect(getEvidenceLabel('spectrogram')).toBe('Spectrogram');
    expect(rows).toEqual([
      { label: 'scale', value: 'mel' },
      { label: 'FFT size', value: '2048' },
      { label: 'frames', value: '42' },
      { label: 'bins', value: '1025' },
      { label: 'Nyquist', value: '24000 Hz' },
    ]);
  });

  it('formats sound quality evidence with psychoacoustic units', () => {
    const rows = buildEvidenceRows({
      evidenceId: 'ev_sound_quality_file_1',
      type: 'sound_quality',
      data: {
        loudnessSone: 21.2345,
        sharpnessAcum: 0.81234,
        roughnessAsper: 0.04321,
      },
    });

    expect(rows).toEqual([
      { label: 'loudness', value: '21.235 sone' },
      { label: 'sharpness', value: '0.812 acum' },
      { label: 'roughness', value: '0.043 asper' },
    ]);
  });

  it('falls back to readable rows for unknown evidence types', () => {
    const rows = buildEvidenceRows({
      evidenceId: 'ev_custom',
      type: 'custom_metric',
      data: {
        fileName: 'sample.wav',
        customValue: 12.3456,
      },
    });

    expect(getEvidenceLabel('custom_metric')).toBe('Custom metric');
    expect(rows).toEqual([
      { label: 'file', value: 'sample.wav' },
      { label: 'custom value', value: '12.346' },
    ]);
  });
});
