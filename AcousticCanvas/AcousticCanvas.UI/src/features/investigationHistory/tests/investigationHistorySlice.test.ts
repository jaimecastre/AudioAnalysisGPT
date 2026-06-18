import { describe, expect, it } from 'vitest';
import investigationHistoryReducer, {
  backendRuntimeObserved,
  investigationRecordsSelector,
  recordAdded,
  recordCleared,
} from '../store/investigationHistorySlice';
import type { InvestigationRecord } from '../types/investigationHistoryTypes';

function makeRecord(index: number): InvestigationRecord {
  return {
    id: `record-${index}`,
    question: `Question ${index}`,
    timestamp: `2026-06-18T10:${String(index).padStart(2, '0')}:00.000Z`,
    toolsRun: [`tool-${index}`],
    confidence: 'high',
    answer: `Answer ${index}`,
    traceId: `trace-${index}`,
    limitations: [],
    plannedTools: [`tool-${index}`],
  };
}

describe('investigationHistorySlice', () => {
  it('initializes with no persisted records', () => {
    const state = investigationHistoryReducer(undefined, { type: 'init' });

    expect(investigationRecordsSelector({ investigationHistory: state })).toEqual([]);
  });

  it('prepends new records', () => {
    const firstState = investigationHistoryReducer(undefined, recordAdded(makeRecord(1)));
    const state = investigationHistoryReducer(firstState, recordAdded(makeRecord(2)));

    expect(investigationRecordsSelector({ investigationHistory: state }).map((record) => record.id)).toEqual([
      'record-2',
      'record-1',
    ]);
  });

  it('caps records at 50 entries', () => {
    let state = investigationHistoryReducer(undefined, { type: 'init' });

    for (let index = 1; index <= 55; index += 1) {
      state = investigationHistoryReducer(state, recordAdded(makeRecord(index)));
    }

    const records = investigationRecordsSelector({ investigationHistory: state });

    expect(records).toHaveLength(50);
    expect(records[0].id).toBe('record-55');
    expect(records[49].id).toBe('record-6');
  });

  it('clears all records', () => {
    const stateWithRecord = investigationHistoryReducer(undefined, recordAdded(makeRecord(1)));
    const state = investigationHistoryReducer(stateWithRecord, recordCleared());

    expect(investigationRecordsSelector({ investigationHistory: state })).toEqual([]);
  });

  it('keeps records when the backend runtime id is unchanged', () => {
    let state = investigationHistoryReducer(undefined, backendRuntimeObserved('runtime-a'));
    state = investigationHistoryReducer(state, recordAdded(makeRecord(1)));
    state = investigationHistoryReducer(state, backendRuntimeObserved('runtime-a'));

    expect(investigationRecordsSelector({ investigationHistory: state }).map((record) => record.id)).toEqual([
      'record-1',
    ]);
  });

  it('clears records when the backend runtime id changes', () => {
    let state = investigationHistoryReducer(undefined, backendRuntimeObserved('runtime-a'));
    state = investigationHistoryReducer(state, recordAdded(makeRecord(1)));
    state = investigationHistoryReducer(state, backendRuntimeObserved('runtime-b'));

    expect(investigationRecordsSelector({ investigationHistory: state })).toEqual([]);
  });
});
