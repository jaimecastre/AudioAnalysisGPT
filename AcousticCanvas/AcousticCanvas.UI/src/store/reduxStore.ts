import { configureStore } from '@reduxjs/toolkit';
import navigationReducer from '../features/navigation/navigationSlice';
import projectReducer from '../features/project/projectSlice';
import waveformSelectionReducer from '../features/waveform/waveformSelectionSlice';
import analysisReducer from '../features/analysis/analysisSlice';
import spectrumReducer from '../features/analysis/spectrumSlice';
import spectrogramReducer from '../features/analysis/spectrogramSlice';
import chatReducer from '../features/agentAnalysis/chatSlice';
import agentWorkspaceReducer from '../features/agentAnalysis/agentWorkspaceSlice';
import findingsReducer from '../features/findings/findingsSlice';

export const store = configureStore({
  reducer: {
    navigation: navigationReducer,
    project: projectReducer,
    waveformSelection: waveformSelectionReducer,
    analysis: analysisReducer,
    spectrum: spectrumReducer,
    spectrogram: spectrogramReducer,
    chat: chatReducer,
    agentWorkspace: agentWorkspaceReducer,
    findings: findingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
