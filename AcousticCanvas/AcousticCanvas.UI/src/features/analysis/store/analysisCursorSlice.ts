import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

// Cross-panel "linked cursor" for analysis panels.
// - hoverFrequencyHz links the frequency-domain panels (spectrum, spectrogram, CPB):
//   hovering a frequency in one highlights the same frequency in the others.
// - hoverTimeSeconds links the time-domain views (waveform, spectrogram):
//   hovering a time in one highlights the same instant in the other.
interface IAnalysisCursorState {
  hoverFrequencyHz: number | null;
  hoverTimeSeconds: number | null;
}

const initialState: IAnalysisCursorState = {
  hoverFrequencyHz: null,
  hoverTimeSeconds: null,
};

const analysisCursorSlice = createSlice({
  name: 'analysisCursor',
  initialState,
  reducers: {
    cursorFrequencyHovered: (state, action: PayloadAction<number>) => {
      state.hoverFrequencyHz = action.payload;
    },
    cursorFrequencyCleared: (state) => {
      state.hoverFrequencyHz = null;
    },
    cursorTimeHovered: (state, action: PayloadAction<number>) => {
      state.hoverTimeSeconds = action.payload;
    },
    cursorTimeCleared: (state) => {
      state.hoverTimeSeconds = null;
    },
  },
});

export const {
  cursorFrequencyHovered,
  cursorFrequencyCleared,
  cursorTimeHovered,
  cursorTimeCleared,
} = analysisCursorSlice.actions;

export default analysisCursorSlice.reducer;

export const cursorFrequencyHzSelector = (state: { analysisCursor: IAnalysisCursorState }): number | null =>
  state.analysisCursor.hoverFrequencyHz;

export const cursorTimeSecondsSelector = (state: { analysisCursor: IAnalysisCursorState }): number | null =>
  state.analysisCursor.hoverTimeSeconds;
