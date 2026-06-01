import type { JSX, KeyboardEvent } from 'react';
import { useRef, useEffect, useState } from 'react';
import { IconArrowUp, IconEraser, IconRobot, IconTool, IconCheck, IconX } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../store/reduxHooks';
import { store } from '../../store/reduxStore';
import {
  chatMessagesSelector,
  chatIsThinkingSelector,
  userMessageSent,
  conversationCleared,
} from './chatSlice';
import type { ChatMessage } from './chatSlice';
import { runAgentToolLoop } from './agentToolRunner';
import { agentWorkspaceCleared } from './agentWorkspaceSlice';
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
  const dispatch = useAppDispatch();
  const messages = useAppSelector(chatMessagesSelector);
  const isThinking = useAppSelector(chatIsThinkingSelector);

  const [inputValue, setInputValue] = useState('');
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, isThinking]);

  const handleTextareaInput = (): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const sendMessage = (): void => {
    const trimmedContent = inputValue.trim();
    if (!trimmedContent || isThinking) return;

    const userMessageId = crypto.randomUUID();
    const userTimestamp = new Date().toISOString();

    dispatch(userMessageSent({
      id: userMessageId,
      content: trimmedContent,
      timestamp: userTimestamp,
    }));

    setInputValue('');
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
    }

    runAgentToolLoop(trimmedContent, dispatch, () => store.getState());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
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

  const hasMessages = messages.length > 0;
  const canSend = inputValue.trim().length > 0 && !isThinking;

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
        <div className={styles.inputRow}>
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
            onClick={sendMessage}
            disabled={!canSend}
            aria-label="Send message"
          >
            <IconArrowUp size={16} />
          </button>
        </div>
        <p className={styles.inputHint}>Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
