import type { JSX } from 'react';
import { useRef, useEffect } from 'react';
import {
  IconArrowUp, IconEraser, IconRobot, IconTool, IconCheck, IconX,
  IconAlignBoxLeftMiddle, IconPaperclip, IconFileMusic, IconFileText,
} from '@tabler/icons-react';
import { useAppSelector } from '../../store/reduxHooks';
import { chatMessagesSelector, chatIsThinkingSelector } from './chatSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import type { ChatMessage } from './chatSlice';
import { ATTACH_ACCEPT } from './chatAttachments';
import { useChatInput } from './useChatInput';
import styles from './ChatPanel.module.scss';

const SUGGESTION_PROMPTS = [
  'What is the peak level of the loaded file?',
  'Run a spectrum analysis on the current selection.',
  'Show me the file format and sample rate.',
  'Where is the loudest region in this file?',
];

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


function UserMessage({ message }: { message: ChatMessage }): JSX.Element {
  return (
    <div className={`${styles.messageWrapper} ${styles.user}`}>
      <div className={styles.messageBubble}>{message.content}</div>
      <div className={styles.messageMeta}>
        <span className={`${styles.messageRole} ${styles.user}`}>You</span>
        <span className={styles.messageTime}>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }): JSX.Element {
  return (
    <div className={`${styles.messageWrapper} ${styles.assistant}`}>
      <div className={styles.messageBubble}>{message.content}</div>
      <div className={styles.messageMeta}>
        <span className={`${styles.messageRole} ${styles.assistant}`}>Agent</span>
        <span className={styles.messageTime}>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
}

function ToolCallMessage({ message }: { message: ChatMessage }): JSX.Element {
  const isRunning = message.toolStatus === 'running';
  const isError = message.toolStatus === 'error';
  return (
    <div className={styles.toolCallRow}>
      <span className={`${styles.toolCallIcon} ${isRunning ? styles.toolCallIconRunning : isError ? styles.toolCallIconError : styles.toolCallIconDone}`}>
        {isRunning ? <IconTool size={11} /> : isError ? <IconX size={11} /> : <IconCheck size={11} />}
      </span>
      <span className={styles.toolCallContent}>{message.content}</span>
    </div>
  );
}

function ThinkingIndicator(): JSX.Element {
  return (
    <div className={styles.thinkingWrapper}>
      <div className={styles.thinkingBubble}>
        <span className={styles.thinkingDot} />
        <span className={styles.thinkingDot} />
        <span className={styles.thinkingDot} />
      </div>
    </div>
  );
}

function SelectionChip({ onExplain }: { onExplain: () => void }): JSX.Element | null {
  const activeSelection = useAppSelector(activeSelectionSelector);
  const hasValidSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  if (!hasValidSelection || !activeSelection) return null;

  const startFormatted = activeSelection.startSeconds.toFixed(3);
  const endFormatted = activeSelection.endSeconds.toFixed(3);
  const durationFormatted = (activeSelection.endSeconds - activeSelection.startSeconds).toFixed(3);

  return (
    <div className={styles.selectionChipBar}>
      <div className={styles.selectionChipInfo}>
        <IconAlignBoxLeftMiddle size={12} className={styles.selectionChipIcon} />
        <span className={styles.selectionChipLabel}>
          {startFormatted}s – {endFormatted}s ({durationFormatted}s)
        </span>
      </div>
      <button
        type="button"
        className={styles.selectionChipButton}
        onClick={onExplain}
        aria-label="Explain this selection"
      >
        Explain selection
      </button>
    </div>
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }): JSX.Element {
  return (
    <div className={styles.emptyState}>
      <IconRobot size={40} className={styles.emptyStateIcon} />
      <p className={styles.emptyStateHeading}>AcousticCanvas Agent</p>
      <p className={styles.emptyStateSubtext}>
        Ask me to analyse your audio, inspect levels, run a spectrum, find events, or describe what you're hearing.
      </p>
      <div className={styles.emptyStateSuggestions}>
        {SUGGESTION_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className={styles.suggestionChip}
            onClick={() => onSuggestionClick(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel(): JSX.Element {
  const messages = useAppSelector(chatMessagesSelector);
  const isThinking = useAppSelector(chatIsThinkingSelector);

  const {
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
  } = useChatInput(isThinking);

  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, isThinking]);

  const hasMessages = messages.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Agent</span>
        {hasMessages && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClearConversation}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <IconEraser size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.messageList} ref={messageListRef}>
        {!hasMessages && (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        )}
        {messages.map((message) => {
          if (message.role === 'user') return <UserMessage key={message.id} message={message} />;
          if (message.role === 'tool_call') return <ToolCallMessage key={message.id} message={message} />;
          return <AssistantMessage key={message.id} message={message} />;
        })}
        {isThinking && <ThinkingIndicator />}
      </div>

      <div className={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACH_ACCEPT}
          className={styles.hiddenFileInput}
          onChange={handleFileInputChange}
          aria-label="Attach files"
        />
        <SelectionChip onExplain={handleExplainSelection} />
        {pendingAttachments.length > 0 && (
          <div className={styles.attachmentChips}>
            {pendingAttachments.map((attachment) => (
              <div key={attachment.name} className={styles.attachmentChip}>
                {attachment.kind === 'audio'
                  ? <IconFileMusic size={11} className={styles.attachmentChipIcon} />
                  : <IconFileText size={11} className={styles.attachmentChipIcon} />}
                <span className={styles.attachmentChipName}>{attachment.name}</span>
                <button
                  type="button"
                  className={styles.attachmentChipRemove}
                  onClick={() => handleRemoveAttachment(attachment.name)}
                  aria-label={`Remove ${attachment.name}`}
                >
                  <IconX size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          <button
            type="button"
            className={styles.attachButton}
            onClick={handleAttachClick}
            disabled={isThinking || isUploading}
            title="Attach audio, PDF, or text file"
            aria-label="Attach file"
          >
            <IconPaperclip size={15} />
          </button>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Ask the agent…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-label="Message input"
          />
          <button
            type="button"
            className={styles.sendButton}
            onClick={handleSendMessage}
            disabled={!canSend}
            aria-label="Send message"
          >
            <IconArrowUp size={16} />
          </button>
        </div>
        <p className={styles.inputHint}>Enter to send · Shift+Enter for newline · 📎 attach audio, PDF, text</p>
      </div>
    </div>
  );
}
