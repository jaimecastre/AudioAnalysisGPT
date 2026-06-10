import { describe, expect, it } from 'vitest';
import type { BatchBenchmarkFileRow } from '../batchBenchmarkTypes';
import {
  formatDbFs,
  formatFrequencyHz,
  formatTonalPeak,
  formatUnitValue,
  sortBenchmarkRows,
} from './benchmarkFormatting';

describe('benchmarkFormatting', () => {
  it('formats benchmark metrics with acoustic units', () => {
    expect(formatDbFs(-12.345)).toBe('-12.3 dBFS');
    expect(formatFrequencyHz(1200)).toBe('1.20 kHz');
    expect(formatUnitValue(1.23456, 'acum')).toBe('1.235 acum');
    expect(formatTonalPeak(buildRow({ strongestTonalPeakFrequencyHz: 499.9, strongestTonalPeakProminenceDb: 12.34 })))
      .toBe('499.9 Hz · 12.3 dB');
  });

  it('sorts rows by raw numeric value instead of formatted text', () => {
    const rows = [
      buildRow({ fileId: 'quiet', fileName: 'quiet.wav', rmsDb: -24 }),
      buildRow({ fileId: 'loud', fileName: 'loud.wav', rmsDb: -6 }),
      buildRow({ fileId: 'middle', fileName: 'middle.wav', rmsDb: -12 }),
    ];

    const sortedRows = sortBenchmarkRows(rows, { key: 'rmsDb', direction: 'descending' });

    expect(sortedRows.map((row) => row.fileId)).toEqual(['loud', 'middle', 'quiet']);
  });

  it('sorts attention by severity counts and flags', () => {
    const rows = [
      buildRow({ fileId: 'clean', fileName: 'clean.wav', flagLabels: [] }),
      buildRow({ fileId: 'medium', fileName: 'medium.wav', mediumSeverityFindingCount: 1, flagLabels: ['Medium severity findings'] }),
      buildRow({ fileId: 'high', fileName: 'high.wav', highSeverityFindingCount: 1, flagLabels: ['High severity findings'] }),
    ];

    const sortedRows = sortBenchmarkRows(rows, { key: 'attention', direction: 'descending' });

    expect(sortedRows.map((row) => row.fileId)).toEqual(['high', 'medium', 'clean']);
  });
});

function buildRow(overrides: Partial<BatchBenchmarkFileRow>): BatchBenchmarkFileRow {
  return {
    fileId: 'file',
    fileName: 'file.wav',
    regionStartSeconds: 0,
    regionEndSeconds: 5,
    rmsDb: -18,
    peakDb: -3,
    crestFactorDb: 15,
    peakFrequencyHz: 1000,
    peakFrequencyMagnitudeDb: -20,
    findingCount: 0,
    highSeverityFindingCount: 0,
    mediumSeverityFindingCount: 0,
    strongestTonalPeakFrequencyHz: null,
    strongestTonalPeakProminenceDb: null,
    loudnessSone: null,
    sharpnessAcum: null,
    roughnessAsper: null,
    soundQualityUnavailableReason: null,
    flagLabels: [],
    topFindings: [],
    ...overrides,
  };
}
