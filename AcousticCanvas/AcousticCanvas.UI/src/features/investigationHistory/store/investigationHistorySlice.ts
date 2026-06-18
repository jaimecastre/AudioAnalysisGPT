import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { InvestigationRecord } from '../types/investigationHistoryTypes';

const MAX_INVESTIGATION_RECORDS = 50;

export interface IInvestigationHistoryState {
  records: InvestigationRecord[];
  focusedRecordId: string | null;
  backendRuntimeId: string | null;
}

const initialState: IInvestigationHistoryState = {
  records: [],
  focusedRecordId: null,
  backendRuntimeId: null,
};

const investigationHistorySlice = createSlice({
  name: 'investigationHistory',
  initialState,
  reducers: {
    recordAdded: (state, action: PayloadAction<InvestigationRecord>) => {
      state.records = [
        action.payload,
        ...state.records.filter((record) => record.id !== action.payload.id),
      ].slice(0, MAX_INVESTIGATION_RECORDS);
      state.focusedRecordId = action.payload.id;
    },
    recordFocused: (state, action: PayloadAction<string>) => {
      state.focusedRecordId = action.payload;
    },
    backendRuntimeObserved: (state, action: PayloadAction<string | null | undefined>) => {
      const backendRuntimeId = action.payload;
      if (!backendRuntimeId) {
        return;
      }

      if (state.backendRuntimeId !== null && state.backendRuntimeId !== backendRuntimeId) {
        state.records = [];
        state.focusedRecordId = null;
      }

      state.backendRuntimeId = backendRuntimeId;
    },
    recordCleared: (state) => {
      state.records = [];
      state.focusedRecordId = null;
    },
  },
});

export const {
  backendRuntimeObserved,
  recordAdded,
  recordFocused,
  recordCleared,
} = investigationHistorySlice.actions;

export default investigationHistorySlice.reducer;

export const investigationRecordsSelector = (
  state: { investigationHistory: IInvestigationHistoryState },
): InvestigationRecord[] => state.investigationHistory.records;

export const focusedInvestigationRecordIdSelector = (
  state: { investigationHistory: IInvestigationHistoryState },
): string | null => state.investigationHistory.focusedRecordId;
