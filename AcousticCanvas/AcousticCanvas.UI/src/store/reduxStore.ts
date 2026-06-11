import { configureStore } from '@reduxjs/toolkit';
import navigationReducer from '../features/navigation/store/navigationSlice';
import projectReducer from '../features/project/store/projectSlice';
import waveformSelectionReducer from '../features/waveform/store/waveformSelectionSlice';
import analysisReducer from '../features/analysis/store/analysisSlice';
import spectrumReducer from '../features/analysis/store/spectrumSlice';
import spectrogramReducer from '../features/analysis/store/spectrogramSlice';
import cpbReducer from '../features/analysis/store/cpbSlice';
import analysisCursorReducer from '../features/analysis/store/analysisCursorSlice';
import chatReducer from '../features/agentAnalysis/store/chatSlice';
import agentWorkspaceReducer from '../features/agentAnalysis/store/agentWorkspaceSlice';
import findingsReducer from '../features/findings/store/findingsSlice';
import agentAskReducer from '../features/agentAnalysis/store/agentAskSlice';
import batchBenchmarkReducer from '../features/batchBenchmark/store/batchBenchmarkSlice';

export const store = configureStore({
  reducer: {
    navigation: navigationReducer,
    project: projectReducer,
    waveformSelection: waveformSelectionReducer,
    analysis: analysisReducer,
    spectrum: spectrumReducer,
    spectrogram: spectrogramReducer,
    cpb: cpbReducer,
    analysisCursor: analysisCursorReducer,
    chat: chatReducer,
    agentWorkspace: agentWorkspaceReducer,
    findings: findingsReducer,
    agentAsk: agentAskReducer,
    batchBenchmark: batchBenchmarkReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
