import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AgentAnalysisResult } from '../agent/agentToolTypes';

export type AgentArtifactAnalysis = {
  type: 'analysis_result';
  id: string;
  timestamp: string;
  result: AgentAnalysisResult;
};

export type AgentArtifactMarker = {
  type: 'marker_added';
  id: string;
  timestamp: string;
  fileId: string;
  timeSeconds: number;
  label: string;
};

export type AgentArtifactSelection = {
  type: 'selection_set';
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
};

export type AgentArtifactViewOpened = {
  type: 'view_opened';
  id: string;
  timestamp: string;
  view: string;
};

export type AgentArtifact =
  | AgentArtifactAnalysis
  | AgentArtifactMarker
  | AgentArtifactSelection
  | AgentArtifactViewOpened;

interface AgentWorkspaceState {
  artifacts: AgentArtifact[];
}

const initialState: AgentWorkspaceState = {
  artifacts: [],
};

const agentWorkspaceSlice = createSlice({
  name: 'agentWorkspace',
  initialState,
  reducers: {
    analysisArtifactAdded: (state, action: PayloadAction<AgentArtifactAnalysis>) => {
      state.artifacts.push(action.payload);
    },
    markerArtifactAdded: (state, action: PayloadAction<AgentArtifactMarker>) => {
      state.artifacts.push(action.payload);
    },
    selectionArtifactAdded: (state, action: PayloadAction<AgentArtifactSelection>) => {
      state.artifacts.push(action.payload);
    },
    viewOpenedArtifactAdded: (state, action: PayloadAction<AgentArtifactViewOpened>) => {
      state.artifacts.push(action.payload);
    },
    agentWorkspaceCleared: () => initialState,
  },
});

export const {
  analysisArtifactAdded,
  markerArtifactAdded,
  selectionArtifactAdded,
  viewOpenedArtifactAdded,
  agentWorkspaceCleared,
} = agentWorkspaceSlice.actions;

export default agentWorkspaceSlice.reducer;

export const agentArtifactsSelector = (state: { agentWorkspace: AgentWorkspaceState }): AgentArtifact[] =>
  state.agentWorkspace.artifacts;
