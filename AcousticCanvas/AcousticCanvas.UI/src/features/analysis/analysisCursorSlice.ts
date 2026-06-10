import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

// Cross-panel "linked cursor" for frequency-domain analysis panels.
// When the user hovers a frequency in one panel (spectrum, spectrogram, …),
// the same frequency is highlighted in the others so spectral features can be
// correlated across views.
interface AnalysisCursorState {
  hoverFrequencyHz: number | null;
}

const initialState: AnalysisCursorState = {
  hoverFrequencyHz: null,
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
  },
});

export const { cursorFrequencyHovered, cursorFrequencyCleared } = analysisCursorSlice.actions;

export default analysisCursorSlice.reducer;

export const cursorFrequencyHzSelector = (state: { analysisCursor: AnalysisCursorState }): number | null =>
  state.analysisCursor.hoverFrequencyHz;
