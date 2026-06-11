import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { SpectrogramAnalysis, SpectrogramUserParameters } from '../types/spectrogramTypes';
import { DEFAULT_SPECTROGRAM_PARAMS } from '../types/spectrogramTypes';

export type SpectrogramStatus = 'idle' | 'running' | 'complete' | 'error';

interface SpectrogramState {
  result: SpectrogramAnalysis | null;
  status: SpectrogramStatus;
  error: string | null;
  activeRequestId: string | null;
  selectedChannelId: string | null;
  userParameters: SpectrogramUserParameters;
}

const initialState: SpectrogramState = {
  result: null,
  status: 'idle',
  error: null,
  activeRequestId: null,
  selectedChannelId: null,
  userParameters: DEFAULT_SPECTROGRAM_PARAMS,
};

const spectrogramSlice = createSlice({
  name: 'spectrogram',
  initialState,
  reducers: {
    spectrogramStarted: (state, action: PayloadAction<string>) => {
      state.status = 'running';
      state.error = null;
      state.activeRequestId = action.payload;
    },
    spectrogramCompleted: (state, action: PayloadAction<{ requestId: string; result: SpectrogramAnalysis }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'complete';
      state.result = action.payload.result;
      state.error = null;
      const channelIds = action.payload.result.channels.map((c) => c.channelId);
      if (!state.selectedChannelId || !channelIds.includes(state.selectedChannelId)) {
        state.selectedChannelId = channelIds[0] ?? null;
      }
    },
    spectrogramFailed: (state, action: PayloadAction<{ requestId: string; message: string }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'error';
      state.error = action.payload.message;
    },
    spectrogramClear: () => initialState,
    spectrogramSetChannel: (state, action: PayloadAction<string>) => {
      state.selectedChannelId = action.payload;
    },
    spectrogramSetParameters: (state, action: PayloadAction<Partial<SpectrogramUserParameters>>) => {
      state.userParameters = { ...state.userParameters, ...action.payload };
    },
  },
});

export const {
  spectrogramStarted,
  spectrogramCompleted,
  spectrogramFailed,
  spectrogramClear,
  spectrogramSetChannel,
  spectrogramSetParameters,
} = spectrogramSlice.actions;

export default spectrogramSlice.reducer;

export const spectrogramResultSelector = (state: { spectrogram: SpectrogramState }): SpectrogramAnalysis | null =>
  state.spectrogram.result;

export const spectrogramStatusSelector = (state: { spectrogram: SpectrogramState }): SpectrogramStatus =>
  state.spectrogram.status;

export const spectrogramErrorSelector = (state: { spectrogram: SpectrogramState }): string | null =>
  state.spectrogram.error;

export const spectrogramSelectedChannelIdSelector = (state: { spectrogram: SpectrogramState }): string | null =>
  state.spectrogram.selectedChannelId;

export const spectrogramUserParametersSelector = (state: { spectrogram: SpectrogramState }): SpectrogramUserParameters =>
  state.spectrogram.userParameters;
