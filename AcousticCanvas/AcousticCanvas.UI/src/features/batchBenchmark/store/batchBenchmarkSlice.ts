import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { BatchBenchmarkResult } from '../types/batchBenchmarkTypes';

export type BenchmarkProgress = {
  completed: number;
  total: number;
  fileName: string;
};

interface IBatchBenchmarkState {
  result: BatchBenchmarkResult | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  isPanelOpen: boolean;
  showModal: boolean;
  progress: BenchmarkProgress | null;
}

const initialState: IBatchBenchmarkState = {
  result: null,
  status: 'idle',
  error: null,
  isPanelOpen: false,
  showModal: false,
  progress: null,
};

const batchBenchmarkSlice = createSlice({
  name: 'batchBenchmark',
  initialState,
  reducers: {
    benchmarkStarted: (state) => {
      state.status = 'loading';
      state.error = null;
      state.isPanelOpen = true;
      state.progress = null;
    },
    benchmarkCompleted: (state, action: PayloadAction<BatchBenchmarkResult>) => {
      state.status = 'idle';
      state.result = action.payload;
      state.error = null;
      state.progress = null;
    },
    benchmarkFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
      state.progress = null;
    },
    benchmarkProgressUpdated: (state, action: PayloadAction<BenchmarkProgress>) => {
      state.progress = action.payload;
    },
    benchmarkPanelClosed: (state) => {
      state.result = null;
      state.status = 'idle';
      state.error = null;
      state.isPanelOpen = false;
      state.progress = null;
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
  benchmarkProgressUpdated,
  benchmarkPanelClosed,
  benchmarkModalOpened,
  benchmarkModalClosed,
} = batchBenchmarkSlice.actions;

export default batchBenchmarkSlice.reducer;

export const benchmarkResultSelector = (state: { batchBenchmark: IBatchBenchmarkState }): BatchBenchmarkResult | null =>
  state.batchBenchmark.result;

export const benchmarkStatusSelector = (state: { batchBenchmark: IBatchBenchmarkState }): 'idle' | 'loading' | 'error' =>
  state.batchBenchmark.status;

export const benchmarkErrorSelector = (state: { batchBenchmark: IBatchBenchmarkState }): string | null =>
  state.batchBenchmark.error;

export const benchmarkIsPanelOpenSelector = (state: { batchBenchmark: IBatchBenchmarkState }): boolean =>
  state.batchBenchmark.isPanelOpen;

export const benchmarkShowModalSelector = (state: { batchBenchmark: IBatchBenchmarkState }): boolean =>
  state.batchBenchmark.showModal;

export const benchmarkProgressSelector = (state: { batchBenchmark: IBatchBenchmarkState }): BenchmarkProgress | null =>
  state.batchBenchmark.progress;
