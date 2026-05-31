import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { SpectrumAnalysis, SpectrumUserParameters } from './spectrumTypes';
import { DEFAULT_SPECTRUM_PARAMS } from './spectrumTypes';

export type SpectrumStatus = 'idle' | 'running' | 'complete' | 'error';

interface SpectrumState {
  result: SpectrumAnalysis | null;
  status: SpectrumStatus;
  error: string | null;
  selectedChannelId: string | null;
  userParameters: SpectrumUserParameters;
}

const initialState: SpectrumState = {
  result: null,
  status: 'idle',
  error: null,
  selectedChannelId: null,
  userParameters: DEFAULT_SPECTRUM_PARAMS,
};

const spectrumSlice = createSlice({
  name: 'spectrum',
  initialState,
  reducers: {
    spectrumStarted: (state) => {
      state.status = 'running';
      state.error = null;
    },
    spectrumCompleted: (state, action: PayloadAction<SpectrumAnalysis>) => {
      state.status = 'complete';
      state.result = action.payload;
      state.error = null;
      // Auto-select first channel if none selected or previous channel gone.
      const channelIds = action.payload.channels.map((c) => c.channelId);
      if (!state.selectedChannelId || !channelIds.includes(state.selectedChannelId)) {
        state.selectedChannelId = channelIds[0] ?? null;
      }
    },
    spectrumFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
    spectrumClear: () => initialState,
    spectrumSetChannel: (state, action: PayloadAction<string>) => {
      state.selectedChannelId = action.payload;
    },
    spectrumSetParameters: (state, action: PayloadAction<Partial<SpectrumUserParameters>>) => {
      state.userParameters = { ...state.userParameters, ...action.payload };
    },
  },
});

export const {
  spectrumStarted,
  spectrumCompleted,
  spectrumFailed,
  spectrumClear,
  spectrumSetChannel,
  spectrumSetParameters,
} = spectrumSlice.actions;

export default spectrumSlice.reducer;

export const spectrumResultSelector = (state: { spectrum: SpectrumState }): SpectrumAnalysis | null =>
  state.spectrum.result;

export const spectrumStatusSelector = (state: { spectrum: SpectrumState }): SpectrumStatus =>
  state.spectrum.status;

export const spectrumErrorSelector = (state: { spectrum: SpectrumState }): string | null =>
  state.spectrum.error;

export const spectrumSelectedChannelIdSelector = (state: { spectrum: SpectrumState }): string | null =>
  state.spectrum.selectedChannelId;

export const spectrumUserParametersSelector = (state: { spectrum: SpectrumState }): SpectrumUserParameters =>
  state.spectrum.userParameters;
