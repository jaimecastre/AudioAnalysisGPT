import { configureStore } from '@reduxjs/toolkit';
import navigationReducer from '../features/navigation/store/navigationSlice';
import projectReducer from '../features/project/store/projectSlice';
import waveformSelectionReducer from '../features/waveform/store/waveformSelectionSlice';
import analysisReducer from '../features/analysis/store/analysisSlice';
import spectrumReducer from '../features/analysis/store/spectrumSlice';
import spectrogramReducer from '../features/analysis/store/spectrogramSlice';
import cpbReducer from '../features/analysis/store/cpbSlice';
import analysisCursorReducer from '../features/analysis/store/analysisCursorSlice';
import { analysisResultsReducer } from '../features/analysis/store/analysisResultsSlice';
import chatReducer from '../features/agentAnalysis/store/chatSlice';
import agentWorkspaceReducer from '../features/agentAnalysis/store/agentWorkspaceSlice';
import findingsReducer, { SAVED_FINDINGS_STORAGE_KEY } from '../features/findings/store/findingsSlice';
import agentAskReducer from '../features/agentAnalysis/store/agentAskSlice';
import batchBenchmarkReducer from '../features/batchBenchmark/store/batchBenchmarkSlice';
import investigationHistoryReducer from '../features/investigationHistory/store/investigationHistorySlice';

const LEGACY_INVESTIGATION_HISTORY_STORAGE_KEY = 'acousticcanvas.investigationHistory';

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
    analysisResults: analysisResultsReducer,
    chat: chatReducer,
    agentWorkspace: agentWorkspaceReducer,
    findings: findingsReducer,
    agentAsk: agentAskReducer,
    batchBenchmark: batchBenchmarkReducer,
    investigationHistory: investigationHistoryReducer,
  },
});

let previousSavedFindings = store.getState().findings.savedFindings;

if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_INVESTIGATION_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; timeline records are intentionally session-only now.
  }
}

store.subscribe(() => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const currentState = store.getState();
  const currentSavedFindings = currentState.findings.savedFindings;

  if (currentSavedFindings !== previousSavedFindings) {
    previousSavedFindings = currentSavedFindings;
    try {
      localStorage.setItem(SAVED_FINDINGS_STORAGE_KEY, JSON.stringify(currentSavedFindings));
    } catch {
      // Persistence is best-effort; Redux state remains the source of truth for the current session.
    }
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
