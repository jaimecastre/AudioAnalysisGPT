import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/reduxHooks';
import { store } from '../../store/reduxStore';
import {
  userMessageSent,
  conversationCleared,
} from './chatSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { agentWorkspaceCleared } from './agentWorkspaceSlice';
import { runAgentToolLoop } from './agentToolRunner';
import { useAudioUpload } from '../audioUpload/useAudioUpload';
import {
  isAudioFile,
  isTextFile,
  readFileAsText,
  buildMessageWithAttachments,
} from './chatAttachments';
import type { PendingAttachment } from './chatAttachments';

export interface UseChatInputReturn {
  inputValue: string;
  setInputValue: (value: string) => void;
  pendingAttachments: PendingAttachment[];
  isUploading: boolean;
  canSend: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleTextareaInput: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSuggestionClick: (suggestionText: string) => void;
  handleAttachClick: () => void;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAttachment: (attachmentName: string) => void;
  handleSendMessage: () => void;
  handleClearConversation: () => void;
  handleExplainSelection: () => void;
}

export function useChatInput(isThinking: boolean): UseChatInputReturn {
  const dispatch = useAppDispatch();
  const activeSelection = useAppSelector(activeSelectionSelector);
  const { uploadFile, isUploading } = useAudioUpload();

  const [inputValue, setInputValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTextareaInput = (): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleAttachClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    if (event.target) event.target.value = '';

    for (const file of files) {
      if (isAudioFile(file)) {
        const uploadedFile = await uploadFile(file);
        if (uploadedFile) {
          setPendingAttachments((prev) => [...prev, { kind: 'audio', file, name: file.name }]);
        }
      } else if (isTextFile(file)) {
        try {
          const content = await readFileAsText(file);
          const truncatedContent = content.slice(0, 8000);
          setPendingAttachments((prev) => [...prev, { kind: 'text', file, name: file.name, content: truncatedContent }]);
        } catch {
          // silently skip unreadable files
        }
      }
    }
  };

  const handleRemoveAttachment = (attachmentName: string): void => {
    setPendingAttachments((prev) => prev.filter((a) => a.name !== attachmentName));
  };

  const handleSendMessage = (): void => {
    const trimmedContent = inputValue.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!trimmedContent && !hasAttachments) || isThinking) return;

    const finalContent = buildMessageWithAttachments(
      trimmedContent || 'I\'ve attached some files. Please review them.',
      pendingAttachments,
    );

    dispatch(userMessageSent({
      id: crypto.randomUUID(),
      content: trimmedContent || `Attached: ${pendingAttachments.map((a) => a.name).join(', ')}`,
      timestamp: new Date().toISOString(),
    }));

    setInputValue('');
    setPendingAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    runAgentToolLoop(finalContent, dispatch, () => store.getState());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestionText: string): void => {
    setInputValue(suggestionText);
    textareaRef.current?.focus();
  };

  const handleClearConversation = (): void => {
    dispatch(conversationCleared());
    dispatch(agentWorkspaceCleared());
  };

  const handleExplainSelection = (): void => {
    if (!activeSelection || isThinking) return;
    const startFormatted = activeSelection.startSeconds.toFixed(3);
    const endFormatted = activeSelection.endSeconds.toFixed(3);
    const explainMessage = `Explain the audio from ${startFormatted}s to ${endFormatted}s. Run level analysis and spectrum analysis on this region and describe what you find.`;

    dispatch(userMessageSent({
      id: crypto.randomUUID(),
      content: explainMessage,
      timestamp: new Date().toISOString(),
    }));

    runAgentToolLoop(explainMessage, dispatch, () => store.getState());
  };

  const canSend = (inputValue.trim().length > 0 || pendingAttachments.length > 0) && !isThinking && !isUploading;

  return {
    inputValue,
    setInputValue,
    pendingAttachments,
    isUploading,
    canSend,
    textareaRef,
    fileInputRef,
    handleTextareaInput,
    handleKeyDown,
    handleSuggestionClick,
    handleAttachClick,
    handleFileInputChange,
    handleRemoveAttachment,
    handleSendMessage,
    handleClearConversation,
    handleExplainSelection,
  };
}
