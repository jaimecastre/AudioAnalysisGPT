import { describe, expect, it } from 'vitest';
import findingsReducer, {
  findingPinned,
  findingUnpinned,
  findingsClear,
  savedFindingsSelector,
} from '../store/findingsSlice';
import type { Finding } from '../types/findingsTypes';

const finding: Finding = {
  findingId: 'finding-001',
  fileId: 'file-001',
  type: 'clipping',
  severity: 'high',
  confidence: 'observed',
  title: 'Clipping detected',
  description: 'Peak samples reached the ceiling.',
  evidence: { peakDbfs: 0 },
  startSeconds: 0.1,
  endSeconds: 0.2,
  frequencyHz: null,
  suggestedNextStep: 'Inspect the clipped region.',
  generatedAt: '2026-06-18T10:00:00.000Z',
};

describe('findingsSlice saved findings', () => {
  it('pins a finding with file name and saved timestamp', () => {
    const state = findingsReducer(
      undefined,
      findingPinned({
        finding,
        fileName: 'motor.wav',
        savedAt: '2026-06-18T10:05:00.000Z',
      }),
    );

    expect(savedFindingsSelector({ findings: state })).toEqual([
      {
        ...finding,
        fileName: 'motor.wav',
        savedAt: '2026-06-18T10:05:00.000Z',
      },
    ]);
  });

  it('replaces an existing pinned finding instead of duplicating it', () => {
    const firstState = findingsReducer(
      undefined,
      findingPinned({
        finding,
        fileName: 'motor.wav',
        savedAt: '2026-06-18T10:05:00.000Z',
      }),
    );

    const secondState = findingsReducer(
      firstState,
      findingPinned({
        finding,
        fileName: 'renamed.wav',
        savedAt: '2026-06-18T10:06:00.000Z',
      }),
    );

    expect(savedFindingsSelector({ findings: secondState })).toHaveLength(1);
    expect(savedFindingsSelector({ findings: secondState })[0].fileName).toBe('renamed.wav');
  });

  it('keeps saved findings when ephemeral findings are cleared', () => {
    const stateWithSavedFinding = findingsReducer(
      undefined,
      findingPinned({
        finding,
        fileName: 'motor.wav',
        savedAt: '2026-06-18T10:05:00.000Z',
      }),
    );

    const clearedState = findingsReducer(stateWithSavedFinding, findingsClear());

    expect(clearedState.result).toBeNull();
    expect(savedFindingsSelector({ findings: clearedState })).toHaveLength(1);
  });

  it('unpins a saved finding by id', () => {
    const stateWithSavedFinding = findingsReducer(
      undefined,
      findingPinned({
        finding,
        fileName: 'motor.wav',
        savedAt: '2026-06-18T10:05:00.000Z',
      }),
    );

    const state = findingsReducer(stateWithSavedFinding, findingUnpinned('finding-001'));

    expect(savedFindingsSelector({ findings: state })).toEqual([]);
  });
});
