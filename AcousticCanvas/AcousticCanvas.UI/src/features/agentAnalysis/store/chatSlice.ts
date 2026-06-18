import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_MODEL_ID } from '../utils/agentModels';
import type { AgentResponseBlock, InvestigationBlock, SoundQualityComparisonBlock, SpectrumOverlayBlock, VisualizationPlanTrace } from '../services/agentAskService';

export type ChatRole = 'user' | 'assistant' | 'tool_call' | 'plan';

export type ToolCallStatus = 'running' | 'done' | 'error';
export type AgentMessageStatus = 'thinking' | 'completed' | 'failed';

export type AgentActivityLabel =
  | 'planning'
  | 'running_tools'
  | 'building_results'
  | 'generating_answer'
  | 'complete'
  | 'failed';

export type ToolStep = {
  toolName: string;
  status: 'completed' | 'failed';
  errorMessage?: string | null;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  status?: AgentMessageStatus;
  toolName?: string;
  toolStatus?: ToolCallStatus;
  toolSteps?: ToolStep[];
  confidence?: string;
  limitations?: string[];
  validationWarning?: boolean;
  plannedTools?: string[];
  plannerReason?: string | null;
  planStatus?: 'planning' | 'done';
  blocks?: AgentResponseBlock[];
  overlayBlocks?: SpectrumOverlayBlock[] | null;
  investigationBlocks?: InvestigationBlock[] | null;
  soundQualityComparisonBlocks?: SoundQualityComparisonBlock[] | null;
  activityLabel?: AgentActivityLabel;
  visualizationPlanTrace?: VisualizationPlanTrace | null;
  investigationRecordId?: string | null;
};

interface IChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  selectedModel: string;
}

const initialState: IChatState = {
  messages: [],
  isThinking: false,
  selectedModel: DEFAULT_MODEL_ID,
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
    assistantMessageReceived: (state, action: PayloadAction<{
      id: string;
      content: string;
      timestamp: string;
      toolSteps?: ToolStep[];
      confidence?: string;
      limitations?: string[];
      validationWarning?: boolean;
      plannedTools?: string[];
      plannerReason?: string | null;
      blocks?: AgentResponseBlock[];
      overlayBlocks?: SpectrumOverlayBlock[] | null;
      investigationBlocks?: InvestigationBlock[] | null;
      soundQualityComparisonBlocks?: SoundQualityComparisonBlock[] | null;
      visualizationPlanTrace?: VisualizationPlanTrace | null;
      investigationRecordId?: string | null;
    }>) => {
      const existingMessage = state.messages.find((message) => message.id === action.payload.id);
      if (existingMessage && existingMessage.role === 'assistant') {
        existingMessage.content = action.payload.content;
        existingMessage.timestamp = action.payload.timestamp;
        existingMessage.status = 'completed';
        existingMessage.activityLabel = 'complete';
        existingMessage.toolSteps = action.payload.toolSteps;
        existingMessage.confidence = action.payload.confidence;
        existingMessage.limitations = action.payload.limitations;
        existingMessage.validationWarning = action.payload.validationWarning;
        existingMessage.plannedTools = action.payload.plannedTools;
        existingMessage.plannerReason = action.payload.plannerReason;
        existingMessage.blocks = action.payload.blocks;
        existingMessage.overlayBlocks = action.payload.overlayBlocks;
        existingMessage.investigationBlocks = action.payload.investigationBlocks;
        existingMessage.soundQualityComparisonBlocks = action.payload.soundQualityComparisonBlocks;
        existingMessage.visualizationPlanTrace = action.payload.visualizationPlanTrace;
        existingMessage.investigationRecordId = action.payload.investigationRecordId;
      } else {
        state.messages.push({
          id: action.payload.id,
          role: 'assistant',
          content: action.payload.content,
          timestamp: action.payload.timestamp,
          status: 'completed',
          toolSteps: action.payload.toolSteps,
          confidence: action.payload.confidence,
          limitations: action.payload.limitations,
          validationWarning: action.payload.validationWarning,
          plannedTools: action.payload.plannedTools,
          plannerReason: action.payload.plannerReason,
          blocks: action.payload.blocks,
          overlayBlocks: action.payload.overlayBlocks,
          investigationBlocks: action.payload.investigationBlocks,
          soundQualityComparisonBlocks: action.payload.soundQualityComparisonBlocks,
          visualizationPlanTrace: action.payload.visualizationPlanTrace,
          investigationRecordId: action.payload.investigationRecordId,
        });
      }
      state.isThinking = false;
    },
    assistantResponseStarted: (state, action: PayloadAction<{ id: string; timestamp: string }>) => {
      state.messages.push({
        id: action.payload.id,
        role: 'assistant',
        content: '',
        timestamp: action.payload.timestamp,
        status: 'thinking',
        activityLabel: 'planning',
      });
      state.isThinking = true;
    },
    assistantActivityUpdated: (state, action: PayloadAction<{ id: string; activityLabel: AgentActivityLabel }>) => {
      const existingMessage = state.messages.find((message) => message.id === action.payload.id);
      if (existingMessage && existingMessage.role === 'assistant') {
        existingMessage.activityLabel = action.payload.activityLabel;
      }
    },
    assistantMessageFailed: (state, action: PayloadAction<{ id: string; error: string; timestamp: string }>) => {
      const existingMessage = state.messages.find((message) => message.id === action.payload.id);
      if (existingMessage && existingMessage.role === 'assistant') {
        existingMessage.content = action.payload.error;
        existingMessage.timestamp = action.payload.timestamp;
        existingMessage.status = 'failed';
        existingMessage.activityLabel = 'failed';
      } else {
        state.messages.push({
          id: action.payload.id,
          role: 'assistant',
          content: action.payload.error,
          timestamp: action.payload.timestamp,
          status: 'failed',
        });
      }
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
    planBubbleStarted: (state, action: PayloadAction<{ id: string; assistantMessageId: string; timestamp: string }>) => {
      const planMessage: ChatMessage = {
        id: action.payload.id,
        role: 'plan',
        content: '',
        timestamp: action.payload.timestamp,
        plannedTools: [],
        plannerReason: null,
        planStatus: 'planning',
      };
      const assistantIndex = state.messages.findIndex((m) => m.id === action.payload.assistantMessageId);
      if (assistantIndex >= 0) {
        state.messages.splice(assistantIndex, 0, planMessage);
      } else {
        state.messages.push(planMessage);
      }
    },
    planBubbleReceived: (state, action: PayloadAction<{ id: string; assistantMessageId: string; plannedTools: string[]; plannerReason: string | null; timestamp: string }>) => {
      const existing = state.messages.find((m) => m.id === action.payload.id);
      if (existing) {
        existing.plannedTools = action.payload.plannedTools;
        existing.plannerReason = action.payload.plannerReason;
        existing.planStatus = 'done';
      } else {
        // Fallback: insert before assistant message if not previously created.
        const planMessage: ChatMessage = {
          id: action.payload.id,
          role: 'plan',
          content: '',
          timestamp: action.payload.timestamp,
          plannedTools: action.payload.plannedTools,
          plannerReason: action.payload.plannerReason,
          planStatus: 'done',
        };
        const assistantIndex = state.messages.findIndex((m) => m.id === action.payload.assistantMessageId);
        if (assistantIndex >= 0) {
          state.messages.splice(assistantIndex, 0, planMessage);
        } else {
          state.messages.push(planMessage);
        }
      }
    },
    planBubbleRemoved: (state, action: PayloadAction<{ id: string }>) => {
      state.messages = state.messages.filter((message) => message.id !== action.payload.id);
    },
    conversationCleared: () => initialState,
    modelSelected: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
  },
});

export const {
  userMessageSent,
  assistantMessageReceived,
  assistantResponseStarted,
  assistantActivityUpdated,
  assistantMessageFailed,
  agentThinkingFinished,
  toolCallStarted,
  toolCallFinished,
  planBubbleStarted,
  planBubbleReceived,
  planBubbleRemoved,
  conversationCleared,
  modelSelected,
} = chatSlice.actions;

export default chatSlice.reducer;

export const chatMessagesSelector = (state: { chat: IChatState }): ChatMessage[] =>
  state.chat.messages;

export const chatIsThinkingSelector = (state: { chat: IChatState }): boolean =>
  state.chat.isThinking;

export const chatSelectedModelSelector = (state: { chat: IChatState }): string =>
  state.chat.selectedModel;
