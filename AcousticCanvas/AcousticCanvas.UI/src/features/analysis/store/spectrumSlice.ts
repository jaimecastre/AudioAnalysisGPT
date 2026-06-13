import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { SpectrumPointsResponse, SpectrumUserParameters } from '../types/spectrumTypes';
import { DEFAULT_SPECTRUM_PARAMS } from '../types/spectrumTypes';

export type SpectrumStatus = 'idle' | 'running' | 'complete' | 'error';

interface ISpectrumState {
  result: SpectrumPointsResponse | null;
  status: SpectrumStatus;
  error: string | null;
  activeRequestId: string | null;
  selectedChannelId: string | null;
  userParameters: SpectrumUserParameters;
}

const initialState: ISpectrumState = {
  result: null,
  status: 'idle',
  error: null,
  activeRequestId: null,
  selectedChannelId: null,
  userParameters: DEFAULT_SPECTRUM_PARAMS,
};

const spectrumSlice = createSlice({
  name: 'spectrum',
  initialState,
  reducers: {
    spectrumStarted: (state, action: PayloadAction<string>) => {
      state.status = 'running';
      state.error = null;
      state.activeRequestId = action.payload;
    },
    spectrumCompleted: (state, action: PayloadAction<{ requestId: string; result: SpectrumPointsResponse }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'complete';
      state.result = action.payload.result;
      state.error = null;
      // Auto-select first channel if none selected or previous channel gone.
      const channelIds = action.payload.result.channels.map((c) => c.channelId);
      if (!state.selectedChannelId || !channelIds.includes(state.selectedChannelId)) {
        state.selectedChannelId = channelIds[0] ?? null;
      }
    },
    spectrumFailed: (state, action: PayloadAction<{ requestId: string; message: string }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'error';
      state.error = action.payload.message;
    },
    spectrumClear: () => initialState,
    spectrumSetChannel: (state, action: PayloadAction<string>) => {
      state.selectedChannelId = action.payload;
    },
    spectrumSetParameters: (state, action: PayloadAction<Partial<SpectrumUserParameters>>) => {
      state.userParameters = { ...state.userParameters, ...action.payload };
    },
    spectrumSetZoomRange: (state, action: PayloadAction<{ minFrequencyHz: number | null; maxFrequencyHz: number | null }>) => {
      state.userParameters.minFrequencyHz = action.payload.minFrequencyHz;
      state.userParameters.maxFrequencyHz = action.payload.maxFrequencyHz;
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
  spectrumSetZoomRange,
} = spectrumSlice.actions;

export default spectrumSlice.reducer;

export const spectrumResultSelector = (state: { spectrum: ISpectrumState }): SpectrumPointsResponse | null =>
  state.spectrum.result;

export const spectrumStatusSelector = (state: { spectrum: ISpectrumState }): SpectrumStatus =>
  state.spectrum.status;

export const spectrumErrorSelector = (state: { spectrum: ISpectrumState }): string | null =>
  state.spectrum.error;

export const spectrumSelectedChannelIdSelector = (state: { spectrum: ISpectrumState }): string | null =>
  state.spectrum.selectedChannelId;

export const spectrumUserParametersSelector = (state: { spectrum: ISpectrumState }): SpectrumUserParameters =>
  state.spectrum.userParameters;
