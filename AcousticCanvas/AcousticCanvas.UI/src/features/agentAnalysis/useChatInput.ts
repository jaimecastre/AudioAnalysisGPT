import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { useState, useRef } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from '../../store/reduxHooks';
import {
  userMessageSent,
  conversationCleared,
} from './chatSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { projectFilesSelector, selectedSignalIdSelector } from '../project/projectSlice';
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
import { routeUserQuestion } from './llm/questionRouter';
import { useAgentAsk } from './hooks/useAgentAsk';

export type MentionCandidate = {
  fileId: string;
  fileName: string;
};

export interface UseChatInputReturn {
  inputValue: string;
  setInputValue: (value: string) => void;
  pendingAttachments: PendingAttachment[];
  isUploading: boolean;
  canSend: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  mentionDropdownCandidates: MentionCandidate[];
  mentionDropdownSelectedIndex: number;
  handleTextareaInput: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSuggestionClick: (suggestionText: string) => void;
  handleMentionSelect: (candidate: MentionCandidate) => void;
  handleCursorChange: (position: number) => void;
  handleAttachClick: () => void;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAttachment: (attachmentName: string) => void;
  handleSendMessage: () => void;
  handleClearConversation: () => void;
  handleExplainSelection: () => void;
  agentAskStatus: ReturnType<typeof useAgentAsk>['status'];
  agentAskResponse: ReturnType<typeof useAgentAsk>['response'];
  agentAskError: ReturnType<typeof useAgentAsk>['error'];
  agentAskIsAnalyzing: boolean;
  handleClarificationReply: (replyText: string) => void;
}

function getActiveMentionToken(text: string, cursorPosition: number): string | null {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const atIndex = textBeforeCursor.lastIndexOf('@');
  if (atIndex === -1) return null;
  const textAfterAt = textBeforeCursor.slice(atIndex + 1);
  const hasSpaceAfterAt = textAfterAt.includes(' ');
  if (hasSpaceAfterAt) return null;
  return textAfterAt;
}

function resolveMentionsInText(text: string, resolvedMentions: Map<string, string>): string {
  return text.replace(/@([\w.-]+)/g, (match, fileName: string) => {
    const fileId = resolvedMentions.get(fileName);
    if (!fileId) return match;
    return `@${fileName} [fileId:${fileId}]`;
  });
}

export function useChatInput(isThinking: boolean): UseChatInputReturn {
  const dispatch = useAppDispatch();
  const activeSelection = useAppSelector(activeSelectionSelector);
  const projectFiles = useAppSelector(projectFilesSelector);
  const selectedSignalId = useAppSelector(selectedSignalIdSelector);
  const reduxStore = useAppStore();
  const { status: agentAskStatus, response: agentAskResponse, error: agentAskError, isAnalyzing: agentAskIsAnalyzing, submitQuestion } = useAgentAsk();
  const { uploadFile, isUploading } = useAudioUpload();

  const [inputValue, setInputValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [mentionDropdownSelectedIndex, setMentionDropdownSelectedIndex] = useState(0);
  const resolvedMentions = useRef<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeMentionToken = getActiveMentionToken(inputValue, cursorPosition);

  const mentionDropdownCandidates: MentionCandidate[] = activeMentionToken !== null
    ? projectFiles
        .filter((file) => file.name.toLowerCase().includes(activeMentionToken.toLowerCase()))
        .map((file) => ({ fileId: file.id, fileName: file.name }))
    : [];

  const handleMentionSelect = (candidate: MentionCandidate): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart ?? inputValue.length;
    const atIndex = inputValue.lastIndexOf('@', cursorPosition - 1);
    if (atIndex === -1) return;

    const beforeAt = inputValue.slice(0, atIndex);
    const afterToken = inputValue.slice(cursorPosition);
    const newValue = `${beforeAt}@${candidate.fileName} ${afterToken}`;

    resolvedMentions.current.set(candidate.fileName, candidate.fileId);
    setInputValue(newValue);
    setCursorPosition(atIndex + candidate.fileName.length + 2);
    setMentionDropdownSelectedIndex(0);

    requestAnimationFrame(() => {
      if (!textarea) return;
      const newCursorPosition = atIndex + candidate.fileName.length + 2;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      textarea.focus();
    });
  };

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

    const textWithResolvedMentions = resolveMentionsInText(trimmedContent, resolvedMentions.current);

    const finalContent = buildMessageWithAttachments(
      textWithResolvedMentions || 'I\'ve attached some files. Please review them.',
      pendingAttachments,
    );

    dispatch(userMessageSent({
      id: crypto.randomUUID(),
      content: trimmedContent || `Attached: ${pendingAttachments.map((a) => a.name).join(', ')}`,
      timestamp: new Date().toISOString(),
    }));

    setInputValue('');
    setPendingAttachments([]);
    resolvedMentions.current.clear();
    setMentionDropdownSelectedIndex(0);
    setCursorPosition(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const route = routeUserQuestion(trimmedContent);

    if (route === 'orchestrator') {
      const allLoadedFileIds = projectFiles.map((file) => file.id);
      const targetFileIds = allLoadedFileIds.length > 0 ? allLoadedFileIds : (selectedSignalId !== null ? [selectedSignalId] : []);
      submitQuestion(trimmedContent, targetFileIds);
    } else {
      runAgentToolLoop(finalContent, dispatch, () => reduxStore.getState());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const dropdownIsOpen = mentionDropdownCandidates.length > 0;

    if (dropdownIsOpen && event.key === 'ArrowDown') {
      event.preventDefault();
      setMentionDropdownSelectedIndex((prev) => Math.min(prev + 1, mentionDropdownCandidates.length - 1));
      return;
    }

    if (dropdownIsOpen && event.key === 'ArrowUp') {
      event.preventDefault();
      setMentionDropdownSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (dropdownIsOpen && event.key === 'Enter') {
      event.preventDefault();
      const selectedCandidate = mentionDropdownCandidates[mentionDropdownSelectedIndex];
      if (selectedCandidate) handleMentionSelect(selectedCandidate);
      return;
    }

    if (dropdownIsOpen && event.key === 'Escape') {
      event.preventDefault();
      setInputValue(inputValue);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleCursorChange = (position: number): void => {
    setCursorPosition(position);
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

    const allLoadedFileIds = projectFiles.map((file) => file.id);
    const targetFileIds = allLoadedFileIds.length > 0 ? allLoadedFileIds : (selectedSignalId !== null ? [selectedSignalId] : []);
    submitQuestion(explainMessage, targetFileIds);
  };

  const handleClarificationReply = (replyText: string): void => {
    const previousQuestion = agentAskResponse?.answer ?? '';
    const combinedQuestion = previousQuestion.length > 0
      ? `${previousQuestion} ${replyText}`
      : replyText;

    dispatch(userMessageSent({
      id: crypto.randomUUID(),
      content: replyText,
      timestamp: new Date().toISOString(),
    }));

    const allLoadedFileIds = projectFiles.map((file) => file.id);
    const targetFileIds = allLoadedFileIds.length > 0 ? allLoadedFileIds : (selectedSignalId !== null ? [selectedSignalId] : []);
    submitQuestion(combinedQuestion, targetFileIds);
  };

  const canSend = (inputValue.trim().length > 0 || pendingAttachments.length > 0) && !isThinking && !isUploading && !agentAskIsAnalyzing;

  return {
    inputValue,
    setInputValue,
    pendingAttachments,
    isUploading,
    canSend,
    textareaRef,
    fileInputRef,
    mentionDropdownCandidates,
    mentionDropdownSelectedIndex,
    handleTextareaInput,
    handleKeyDown,
    handleSuggestionClick,
    handleMentionSelect,
    handleCursorChange,
    handleAttachClick,
    handleFileInputChange,
    handleRemoveAttachment,
    handleSendMessage,
    handleClearConversation,
    handleExplainSelection,
    agentAskStatus,
    agentAskResponse,
    agentAskError,
    agentAskIsAnalyzing,
    handleClarificationReply,
  };
}
