import { useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { chatMessagesSelector, chatIsThinkingSelector, chatSelectedModelSelector, modelSelected } from '../store/chatSlice';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { useChatInput } from '../hooks/useChatInput';

export function useChatPanel() {
  const messages = useAppSelector(chatMessagesSelector);
  const isThinking = useAppSelector(chatIsThinkingSelector);
  const selectedModel = useAppSelector(chatSelectedModelSelector);
  const dispatch = useAppDispatch();

  const chatInput = useChatInput(isThinking);

  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, isThinking]);

  const hasMessages = messages.length > 0;
  const agentPanelResponse = chatInput.agentAskResponse !== null && chatInput.agentAskResponse.toolExecutions.length === 0
    ? chatInput.agentAskResponse
    : null;

  const handleModelChange = (modelId: string): void => {
    dispatch(modelSelected(modelId));
  };

  return {
    messages,
    isThinking,
    selectedModel,
    messageListRef,
    hasMessages,
    agentPanelResponse,
    handleModelChange,
    ...chatInput,
  };
}

export function useSelectionChip() {
  const activeSelection = useAppSelector(activeSelectionSelector);
  const hasValidSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  return { activeSelection, hasValidSelection };
}
