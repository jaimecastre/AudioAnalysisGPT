import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export interface WaveformSelection {
  id: string;
  startSeconds: number;
  endSeconds: number;
}

interface WaveformSelectionState {
  activeSelection: WaveformSelection | null;
  loopEnabled: boolean;
  showDisplay: boolean;
}

const initialState: WaveformSelectionState = {
  activeSelection: null,
  loopEnabled: false,
  showDisplay: true,
};

const waveformSelectionSlice = createSlice({
  name: 'waveformSelection',
  initialState,
  reducers: {
    setActiveSelection: (state, action: PayloadAction<WaveformSelection>) => {
      state.activeSelection = action.payload;
    },
    updateActiveSelection: (state, action: PayloadAction<Omit<WaveformSelection, 'id'>>) => {
      if (state.activeSelection) {
        state.activeSelection.startSeconds = action.payload.startSeconds;
        state.activeSelection.endSeconds = action.payload.endSeconds;
      }
    },
    clearActiveSelection: (state) => {
      state.activeSelection = null;
    },
    setLoopEnabled: (state, action: PayloadAction<boolean>) => {
      state.loopEnabled = action.payload;
    },
    setWaveformDisplayShown: (state, action: PayloadAction<boolean>) => {
      state.showDisplay = action.payload;
    },
  },
});

export const {
  setActiveSelection,
  updateActiveSelection,
  clearActiveSelection,
  setLoopEnabled,
  setWaveformDisplayShown,
} = waveformSelectionSlice.actions;

export default waveformSelectionSlice.reducer;

export const activeSelectionSelector = (state: { waveformSelection: WaveformSelectionState }): WaveformSelection | null =>
  state.waveformSelection.activeSelection;

export const loopEnabledSelector = (state: { waveformSelection: WaveformSelectionState }): boolean =>
  state.waveformSelection.loopEnabled;

export const showWaveformDisplaySelector = (state: { waveformSelection: WaveformSelectionState }): boolean =>
  state.waveformSelection.showDisplay;
