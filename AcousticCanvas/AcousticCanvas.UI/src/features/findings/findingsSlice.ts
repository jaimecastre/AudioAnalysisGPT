import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient, HttpMethod } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import type { FindingsResult } from './findingsTypes';

export type FindingsStatus = 'idle' | 'running' | 'complete' | 'error';

interface FindingsState {
  result: FindingsResult | null;
  status: FindingsStatus;
  error: string | null;
}

const initialState: FindingsState = {
  result: null,
  status: 'idle',
  error: null,
};

export const runFindingsAnalysis = createAsyncThunk<FindingsResult, string>(
  'findings/runFindingsAnalysis',
  async (fileId: string) => {
    const result = await apiClient.requestJson<FindingsResult>(
      API_ENDPOINTS.AUDIO.RUN_FINDINGS,
      {
        method: HttpMethod.POST,
        body: { fileId },
      },
    );
    return result;
  },
);

const findingsSlice = createSlice({
  name: 'findings',
  initialState,
  reducers: {
    findingsClear: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(runFindingsAnalysis.pending, (state) => {
      state.status = 'running';
      state.error = null;
    });
    builder.addCase(runFindingsAnalysis.fulfilled, (state, action: PayloadAction<FindingsResult>) => {
      state.status = 'complete';
      state.result = action.payload;
      state.error = null;
    });
    builder.addCase(runFindingsAnalysis.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.error.message ?? 'Findings analysis failed';
    });
  },
});

export const { findingsClear } = findingsSlice.actions;

export default findingsSlice.reducer;

export const findingsResultSelector = (state: { findings: FindingsState }): FindingsResult | null =>
  state.findings.result;

export const findingsStatusSelector = (state: { findings: FindingsState }): FindingsStatus =>
  state.findings.status;

export const findingsErrorSelector = (state: { findings: FindingsState }): string | null =>
  state.findings.error;
