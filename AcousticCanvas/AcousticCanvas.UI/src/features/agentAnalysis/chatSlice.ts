import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export type ChatRole = 'user' | 'assistant' | 'tool_call';

export type ToolCallStatus = 'running' | 'done' | 'error';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  toolName?: string;
  toolStatus?: ToolCallStatus;
};

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
}

const initialState: ChatState = {
  messages: [],
  isThinking: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    userMessageSent: (state, action: PayloadAction<{ id: string; content: string; timestamp: string }>) => {
      state.messages.push({
        id: action.payload.id,
        role: 'user',
        content: action.payload.content,
        timestamp: action.payload.timestamp,
      });
      state.isThinking = true;
    },
    assistantMessageReceived: (state, action: PayloadAction<{ id: string; content: string; timestamp: string }>) => {
      state.messages.push({
        id: action.payload.id,
        role: 'assistant',
        content: action.payload.content,
        timestamp: action.payload.timestamp,
      });
      state.isThinking = false;
    },
    agentThinkingFinished: (state) => {
      state.isThinking = false;
    },
    toolCallStarted: (state, action: PayloadAction<{ id: string; toolName: string; content: string; timestamp: string }>) => {
      state.messages.push({
        id: action.payload.id,
        role: 'tool_call',
        content: action.payload.content,
        timestamp: action.payload.timestamp,
        toolName: action.payload.toolName,
        toolStatus: 'running',
      });
    },
    toolCallFinished: (state, action: PayloadAction<{ id: string; toolStatus: ToolCallStatus; content: string }>) => {
      const existingMessage = state.messages.find((message) => message.id === action.payload.id);
      if (existingMessage) {
        existingMessage.toolStatus = action.payload.toolStatus;
        existingMessage.content = action.payload.content;
      }
    },
    conversationCleared: () => initialState,
  },
});

export const {
  userMessageSent,
  assistantMessageReceived,
  agentThinkingFinished,
  toolCallStarted,
  toolCallFinished,
  conversationCleared,
} = chatSlice.actions;

export default chatSlice.reducer;

export const chatMessagesSelector = (state: { chat: ChatState }): ChatMessage[] =>
  state.chat.messages;

export const chatIsThinkingSelector = (state: { chat: ChatState }): boolean =>
  state.chat.isThinking;
