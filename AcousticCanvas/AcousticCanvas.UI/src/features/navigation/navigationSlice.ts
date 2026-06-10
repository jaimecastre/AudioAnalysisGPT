import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AudioFileId, ActiveMode } from '../../store/projectState';

const NAVIGATION_SLICE_NAME = 'navigation';

export interface INavigationState {
  activeMode: ActiveMode;
  activeFileId: AudioFileId | null;
  activeView: 'home' | 'import' | 'analysis';
  agentPromptPrefill: string | null;
}

const initialState: INavigationState = {
  activeMode: 'manual',
  activeFileId: null,
  activeView: 'home',
  agentPromptPrefill: null,
};

const navigationSlice = createSlice({
  name: NAVIGATION_SLICE_NAME,
  initialState,
  reducers: {
    setActiveMode: (state, action: PayloadAction<ActiveMode>) => {
      state.activeMode = action.payload;
    },
    setActiveFileId: (state, action: PayloadAction<AudioFileId | null>) => {
      state.activeFileId = action.payload;
    },
    setActiveView: (state, action: PayloadAction<'home' | 'import' | 'analysis'>) => {
      state.activeView = action.payload;
    },
    agentPromptPrefillSet: (state, action: PayloadAction<string>) => {
      state.agentPromptPrefill = action.payload;
    },
    agentPromptPrefillCleared: (state) => {
      state.agentPromptPrefill = null;
    },
  },
});

export const { setActiveMode, setActiveFileId, setActiveView, agentPromptPrefillSet, agentPromptPrefillCleared } = navigationSlice.actions;

export default navigationSlice.reducer;

export const activeModeSelector = (state: { navigation: INavigationState }): ActiveMode =>
  state.navigation.activeMode;

export const activeFileIdSelector = (state: { navigation: INavigationState }): AudioFileId | null =>
  state.navigation.activeFileId;

export const activeViewSelector = (state: { navigation: INavigationState }): 'home' | 'import' | 'analysis' =>
  state.navigation.activeView;

export const agentPromptPrefillSelector = (state: { navigation: INavigationState }): string | null =>
  state.navigation.agentPromptPrefill;
