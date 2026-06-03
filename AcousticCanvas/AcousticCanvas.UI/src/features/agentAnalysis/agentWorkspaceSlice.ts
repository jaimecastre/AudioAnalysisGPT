import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AgentAnalysisResult, CompareResult, FindEventsResult } from '../agent/agentToolTypes';

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

export type AgentArtifactCompare = {
  type: 'compare_result';
  id: string;
  timestamp: string;
  result: CompareResult;
};

export type AgentArtifactFind = {
  type: 'find_result';
  id: string;
  timestamp: string;
  result: FindEventsResult;
};

export type AgentArtifactReport = {
  type: 'report';
  id: string;
  timestamp: string;
  title: string;
  markdownContent: string;
};

export type AgentArtifact =
  | AgentArtifactAnalysis
  | AgentArtifactMarker
  | AgentArtifactSelection
  | AgentArtifactViewOpened
  | AgentArtifactCompare
  | AgentArtifactFind
  | AgentArtifactReport;

interface AgentWorkspaceState {
  artifacts: AgentArtifact[];
  focusedArtifactId: string | null;
}

const initialState: AgentWorkspaceState = {
  artifacts: [],
  focusedArtifactId: null,
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
    compareArtifactAdded: (state, action: PayloadAction<AgentArtifactCompare>) => {
      state.artifacts.push(action.payload);
    },
    findArtifactAdded: (state, action: PayloadAction<AgentArtifactFind>) => {
      state.artifacts.push(action.payload);
    },
    reportArtifactAdded: (state, action: PayloadAction<AgentArtifactReport>) => {
      state.artifacts.push(action.payload);
    },
    artifactFocused: (state, action: PayloadAction<string>) => {
      state.focusedArtifactId = action.payload;
    },
    artifactFocusCleared: (state) => {
      state.focusedArtifactId = null;
    },
    agentWorkspaceCleared: () => initialState,
  },
});

export const {
  analysisArtifactAdded,
  markerArtifactAdded,
  selectionArtifactAdded,
  viewOpenedArtifactAdded,
  compareArtifactAdded,
  findArtifactAdded,
  reportArtifactAdded,
  artifactFocused,
  artifactFocusCleared,
  agentWorkspaceCleared,
} = agentWorkspaceSlice.actions;

export default agentWorkspaceSlice.reducer;

export const agentArtifactsSelector = (state: { agentWorkspace: AgentWorkspaceState }): AgentArtifact[] =>
  state.agentWorkspace.artifacts;

export const focusedArtifactIdSelector = (state: { agentWorkspace: AgentWorkspaceState }): string | null =>
  state.agentWorkspace.focusedArtifactId;
