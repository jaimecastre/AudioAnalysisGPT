import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AgentAskResponse, AgentToolExecutionRecord } from './services/agentAskService';

export type AgentAskStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface AgentAskState {
  status: AgentAskStatus;
  lastResponse: AgentAskResponse | null;
  error: string | null;
}

const initialAgentAskState: AgentAskState = {
  status: 'idle',
  lastResponse: null,
  error: null,
};

const agentAskSlice = createSlice({
  name: 'agentAsk',
  initialState: initialAgentAskState,
  reducers: {
    agentAskStarted: (state) => {
      state.status = 'analyzing';
      state.error = null;
    },
    agentAskSucceeded: (state, action: PayloadAction<AgentAskResponse>) => {
      state.status = 'done';
      state.lastResponse = action.payload;
      state.error = null;
    },
    agentAskFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
    agentAskReset: () => initialAgentAskState,
  },
});

export const {
  agentAskStarted,
  agentAskSucceeded,
  agentAskFailed,
  agentAskReset,
} = agentAskSlice.actions;

export default agentAskSlice.reducer;

export const agentAskStatusSelector = (state: { agentAsk: AgentAskState }): AgentAskStatus =>
  state.agentAsk.status;

export const agentAskResponseSelector = (state: { agentAsk: AgentAskState }): AgentAskResponse | null =>
  state.agentAsk.lastResponse;

export const agentAskErrorSelector = (state: { agentAsk: AgentAskState }): string | null =>
  state.agentAsk.error;

export type { AgentToolExecutionRecord };
