import type { BatchBenchmarkFileRow } from '../types/batchBenchmarkTypes';

export type BenchmarkSortKey =
  | 'attention'
  | 'fileName'
  | 'rmsDb'
  | 'peakDb'
  | 'crestFactorDb'
  | 'peakFrequencyHz'
  | 'findingCount'
  | 'strongestTonalPeakProminenceDb'
  | 'loudnessSone'
  | 'sharpnessAcum'
  | 'roughnessAsper';

export type BenchmarkSortDirection = 'ascending' | 'descending';

export type BenchmarkSortState = {
  key: BenchmarkSortKey;
  direction: BenchmarkSortDirection;
};

export function formatDbFs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(1)} dBFS`;
}

export function formatDb(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(1)} dB`;
}

export function formatFrequencyHz(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)} kHz`;
  }

  return `${value.toFixed(1)} Hz`;
}

export function formatUnitValue(
  value: number | null | undefined,
  unit: 'sone' | 'acum' | 'asper',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(3)} ${unit}`;
}

export function formatTonalPeak(row: BatchBenchmarkFileRow): string {
  const frequency = formatFrequencyHz(row.strongestTonalPeakFrequencyHz);
  const prominence = formatDb(row.strongestTonalPeakProminenceDb);

  if (frequency === '—' || prominence === '—') {
    return '—';
  }

  return `${frequency} · ${prominence}`;
}

export function getAttentionScore(row: BatchBenchmarkFileRow): number {
  return (row.highSeverityFindingCount * 100)
    + (row.mediumSeverityFindingCount * 25)
    + (row.flagLabels.length * 10)
    + row.findingCount;
}

export function sortBenchmarkRows(
  rows: BatchBenchmarkFileRow[],
  sortState: BenchmarkSortState,
): BatchBenchmarkFileRow[] {
  const sortedRows = [...rows];

  sortedRows.sort((a, b) => {
    const comparison = compareRows(a, b, sortState.key);
    if (comparison === 0) {
      return a.fileName.localeCompare(b.fileName);
    }

    return sortState.direction === 'ascending' ? comparison : -comparison;
  });

  return sortedRows;
}

function compareRows(a: BatchBenchmarkFileRow, b: BatchBenchmarkFileRow, key: BenchmarkSortKey): number {
  if (key === 'fileName') {
    return a.fileName.localeCompare(b.fileName);
  }

  const valueA = getComparableValue(a, key);
  const valueB = getComparableValue(b, key);

  if (valueA === null && valueB === null) return 0;
  if (valueA === null) return -1;
  if (valueB === null) return 1;

  return valueA - valueB;
}

function getComparableValue(row: BatchBenchmarkFileRow, key: BenchmarkSortKey): number | null {
  if (key === 'attention') return getAttentionScore(row);
  if (key === 'rmsDb') return row.rmsDb;
  if (key === 'peakDb') return row.peakDb;
  if (key === 'crestFactorDb') return row.crestFactorDb;
  if (key === 'peakFrequencyHz') return row.peakFrequencyHz;
  if (key === 'findingCount') return row.findingCount;
  if (key === 'strongestTonalPeakProminenceDb') return row.strongestTonalPeakProminenceDb;
  if (key === 'loudnessSone') return row.loudnessSone;
  if (key === 'sharpnessAcum') return row.sharpnessAcum;
  if (key === 'roughnessAsper') return row.roughnessAsper;

  return null;
}
