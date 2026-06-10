import { describe, expect, it } from 'vitest';
import { buildSoundQualityRows, getSoundQualityUnavailableMessage } from './soundQualityComparisonRows';

describe('buildSoundQualityRows', () => {
  it('uses winner fileIds from backend delta fields for each metric', () => {
    const rows = buildSoundQualityRows({
      soundQualityA: {
        loudnessSone: 8.1,
        sharpnessAcum: 1.2,
        roughnessAsper: 0.061,
        method: 'mosqito_stationary_zwicker',
      },
      soundQualityB: {
        loudnessSone: 9.4,
        sharpnessAcum: 1.11,
        roughnessAsper: 0.074,
        method: 'mosqito_stationary_zwicker',
      },
      soundQualityDelta: {
        loudnessDeltaSone: 1.3,
        sharpnessDeltaAcum: -0.09,
        roughnessDeltaAsper: 0.013,
        louderFileId: 'b-id',
        sharperFileId: 'a-id',
        rougherFileId: 'b-id',
      },
      fileIdA: 'a-id',
      fileIdB: 'b-id',
      labelA: 'File A',
      labelB: 'File B',
    });

    expect(rows.map((row) => row.higherLabel)).toEqual(['File B', 'File A', 'File B']);
  });
});

describe('getSoundQualityUnavailableMessage', () => {
  it('returns API-provided reason when available', () => {
    expect(getSoundQualityUnavailableMessage('Python sidecar unavailable')).toBe('Python sidecar unavailable');
  });

  it('returns a stable fallback when reason is missing', () => {
    expect(getSoundQualityUnavailableMessage(undefined)).toContain('Sound-quality comparison is unavailable');
  });
});
