import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { SpectrumPointsResponse } from '../types/spectrumTypes';
import type { SoundQualityAnalysis } from '../types/soundQualityTypes';
import type { CpbAnalysis } from '../types/cpbTypes';
import type { FindingsResult } from '../../findings/types/findingsTypes';

export type AnalysisResultType = 'spectrum' | 'soundQuality' | 'cpb' | 'findings';

export type AnalysisResult =
  | { type: 'spectrum'; data: SpectrumPointsResponse }
  | { type: 'soundQuality'; data: SoundQualityAnalysis }
  | { type: 'cpb'; data: CpbAnalysis }
  | { type: 'findings'; data: FindingsResult };

export interface IAnalysisResultsState {
  resultsById: Record<string, AnalysisResult>;
  loadingIds: Record<string, boolean>;
  errorById: Record<string, string>;
}

const initialState: IAnalysisResultsState = {
  resultsById: {},
  loadingIds: {},
  errorById: {},
};

const analysisResultsSlice = createSlice({
  name: 'analysisResults',
  initialState,
  reducers: {
    analysisResultRequested: (state, action: PayloadAction<string>) => {
      state.loadingIds[action.payload] = true;
      delete state.errorById[action.payload];
    },
    analysisResultLoaded: (
      state,
      action: PayloadAction<{ resultId: string; result: AnalysisResult }>
    ) => {
      const { resultId, result } = action.payload;
      state.resultsById[resultId] = result;
      delete state.loadingIds[resultId];
      delete state.errorById[resultId];
    },
    analysisResultFailed: (
      state,
      action: PayloadAction<{ resultId: string; error: string }>
    ) => {
      const { resultId, error } = action.payload;
      state.errorById[resultId] = error;
      delete state.loadingIds[resultId];
    },
    analysisResultCleared: (state, action: PayloadAction<string>) => {
      const resultId = action.payload;
      delete state.resultsById[resultId];
      delete state.errorById[resultId];
      delete state.loadingIds[resultId];
    },
  },
});

export const {
  analysisResultRequested,
  analysisResultLoaded,
  analysisResultFailed,
  analysisResultCleared,
} = analysisResultsSlice.actions;

export const analysisResultsReducer = analysisResultsSlice.reducer;
