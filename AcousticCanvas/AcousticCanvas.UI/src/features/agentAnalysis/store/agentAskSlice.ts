import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AgentAskResponse, AgentToolExecutionRecord } from './services/agentAskService';

export type AgentAskStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface IAgentAskState {
  status: AgentAskStatus;
  lastResponse: AgentAskResponse | null;
  error: string | null;
}

const initialAgentAskState: IAgentAskState = {
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

export const agentAskStatusSelector = (state: { agentAsk: IAgentAskState }): AgentAskStatus =>
  state.agentAsk.status;

export const agentAskResponseSelector = (state: { agentAsk: IAgentAskState }): AgentAskResponse | null =>
  state.agentAsk.lastResponse;

export const agentAskErrorSelector = (state: { agentAsk: IAgentAskState }): string | null =>
  state.agentAsk.error;

export type { AgentToolExecutionRecord };
