import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { BatchBenchmarkResult } from '../types/batchBenchmarkTypes';

interface BatchBenchmarkState {
  result: BatchBenchmarkResult | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  isPanelOpen: boolean;
  showModal: boolean;
}

const initialState: BatchBenchmarkState = {
  result: null,
  status: 'idle',
  error: null,
  isPanelOpen: false,
  showModal: false,
};

const batchBenchmarkSlice = createSlice({
  name: 'batchBenchmark',
  initialState,
  reducers: {
    benchmarkStarted: (state) => {
      state.status = 'loading';
      state.error = null;
      state.isPanelOpen = true;
    },
    benchmarkCompleted: (state, action: PayloadAction<BatchBenchmarkResult>) => {
      state.status = 'idle';
      state.result = action.payload;
      state.error = null;
    },
    benchmarkFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
    benchmarkPanelClosed: (state) => {
      state.result = null;
      state.status = 'idle';
      state.error = null;
      state.isPanelOpen = false;
    },
    benchmarkModalOpened: (state) => {
      state.showModal = true;
    },
    benchmarkModalClosed: (state) => {
      state.showModal = false;
    },
  },
});

export const {
  benchmarkStarted,
  benchmarkCompleted,
  benchmarkFailed,
  benchmarkPanelClosed,
  benchmarkModalOpened,
  benchmarkModalClosed,
} = batchBenchmarkSlice.actions;

export default batchBenchmarkSlice.reducer;

export const benchmarkResultSelector = (state: { batchBenchmark: BatchBenchmarkState }): BatchBenchmarkResult | null =>
  state.batchBenchmark.result;

export const benchmarkStatusSelector = (state: { batchBenchmark: BatchBenchmarkState }): 'idle' | 'loading' | 'error' =>
  state.batchBenchmark.status;

export const benchmarkErrorSelector = (state: { batchBenchmark: BatchBenchmarkState }): string | null =>
  state.batchBenchmark.error;

export const benchmarkIsPanelOpenSelector = (state: { batchBenchmark: BatchBenchmarkState }): boolean =>
  state.batchBenchmark.isPanelOpen;

export const benchmarkShowModalSelector = (state: { batchBenchmark: BatchBenchmarkState }): boolean =>
  state.batchBenchmark.showModal;
