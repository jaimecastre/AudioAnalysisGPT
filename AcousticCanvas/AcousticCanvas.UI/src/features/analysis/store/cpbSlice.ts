import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { CpbAnalysis, CpbUserParameters } from '../types/cpbTypes';
import { DEFAULT_CPB_PARAMS } from '../types/cpbTypes';

export type CpbStatus = 'idle' | 'running' | 'complete' | 'error';

interface CpbState {
  result: CpbAnalysis | null;
  status: CpbStatus;
  error: string | null;
  activeRequestId: string | null;
  selectedChannelId: string | null;
  userParameters: CpbUserParameters;
}

const initialState: CpbState = {
  result: null,
  status: 'idle',
  error: null,
  activeRequestId: null,
  selectedChannelId: null,
  userParameters: DEFAULT_CPB_PARAMS,
};

const cpbSlice = createSlice({
  name: 'cpb',
  initialState,
  reducers: {
    cpbStarted: (state, action: PayloadAction<string>) => {
      state.status = 'running';
      state.error = null;
      state.activeRequestId = action.payload;
    },
    cpbCompleted: (state, action: PayloadAction<{ requestId: string; result: CpbAnalysis }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'complete';
      state.result = action.payload.result;
      state.error = null;
      const channelIds = action.payload.result.channels.map((channel) => channel.channelId);
      if (!state.selectedChannelId || !channelIds.includes(state.selectedChannelId)) {
        state.selectedChannelId = channelIds[0] ?? null;
      }
    },
    cpbFailed: (state, action: PayloadAction<{ requestId: string; message: string }>) => {
      if (state.activeRequestId !== action.payload.requestId) return;
      state.status = 'error';
      state.error = action.payload.message;
    },
    cpbClear: () => initialState,
    cpbSetChannel: (state, action: PayloadAction<string>) => {
      state.selectedChannelId = action.payload;
    },
    cpbSetParameters: (state, action: PayloadAction<Partial<CpbUserParameters>>) => {
      state.userParameters = { ...state.userParameters, ...action.payload };
    },
  },
});

export const {
  cpbStarted,
  cpbCompleted,
  cpbFailed,
  cpbClear,
  cpbSetChannel,
  cpbSetParameters,
} = cpbSlice.actions;

export default cpbSlice.reducer;

export const cpbResultSelector = (state: { cpb: CpbState }): CpbAnalysis | null =>
  state.cpb.result;

export const cpbStatusSelector = (state: { cpb: CpbState }): CpbStatus =>
  state.cpb.status;

export const cpbErrorSelector = (state: { cpb: CpbState }): string | null =>
  state.cpb.error;

export const cpbSelectedChannelIdSelector = (state: { cpb: CpbState }): string | null =>
  state.cpb.selectedChannelId;

export const cpbUserParametersSelector = (state: { cpb: CpbState }): CpbUserParameters =>
  state.cpb.userParameters;
