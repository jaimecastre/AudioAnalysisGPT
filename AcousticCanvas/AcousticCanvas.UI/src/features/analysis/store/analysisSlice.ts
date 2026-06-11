import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AnalysisResult } from '../types/analysisTypes';

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

interface AnalysisState {
  result: AnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  showInspector: boolean;
}

const initialState: AnalysisState = {
  result: null,
  status: 'idle',
  error: null,
  showInspector: false,
};

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    analysisStarted: (state) => {
      state.status = 'running';
      state.error = null;
    },
    analysisCompleted: (state, action: PayloadAction<AnalysisResult>) => {
      state.status = 'complete';
      state.result = action.payload;
      state.error = null;
    },
    analysisFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
    analysisClear: () => initialState,
    analysisInspectorOpened: (state) => {
      state.showInspector = true;
    },
    analysisInspectorClosed: (state) => {
      state.showInspector = false;
    },
  },
});

export const {
  analysisStarted,
  analysisCompleted,
  analysisFailed,
  analysisClear,
  analysisInspectorOpened,
  analysisInspectorClosed,
} = analysisSlice.actions;

export default analysisSlice.reducer;

export const analysisResultSelector = (state: { analysis: AnalysisState }): AnalysisResult | null =>
  state.analysis.result;

export const analysisStatusSelector = (state: { analysis: AnalysisState }): AnalysisStatus =>
  state.analysis.status;

export const analysisErrorSelector = (state: { analysis: AnalysisState }): string | null =>
  state.analysis.error;

export const analysisShowInspectorSelector = (state: { analysis: AnalysisState }): boolean =>
  state.analysis.showInspector;
