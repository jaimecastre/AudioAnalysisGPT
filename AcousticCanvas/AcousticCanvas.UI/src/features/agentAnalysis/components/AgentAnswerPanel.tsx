import type { JSX, KeyboardEvent } from 'react';
import { useState } from 'react';
import type { AgentAskResponse } from '../services/agentAskService';
import type { AgentAskStatus } from '../store/agentAskSlice';
import styles from './AgentAnswerPanel.module.scss';

interface IAgentAnswerPanelProps {
  status: AgentAskStatus;
  response: AgentAskResponse | null;
  error: string | null;
  onReply: (replyText: string) => void;
}

function isClarificationResponse(response: AgentAskResponse): boolean {
  const hasNoToolsRun = response.toolExecutions.length === 0;
  const hasClarificationLimitation = response.limitations.some(
    (limitation) => limitation.toLowerCase().includes('clarification'),
  );
  return hasNoToolsRun && hasClarificationLimitation;
}

function ClarificationReply({
  question,
  onReply,
}: {
  question: string;
  onReply: (replyText: string) => void;
}): JSX.Element {
  const [replyValue, setReplyValue] = useState('');

  function handleSend() {
    const trimmed = replyValue.trim();
    if (trimmed.length === 0) return;
    onReply(trimmed);
    setReplyValue('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={styles.clarificationPanel}>
      <div className={styles.clarificationQuestion}>{question}</div>
      <div className={styles.clarificationInputRow}>
        <input
          className={styles.clarificationInput}
          type="text"
          placeholder="Type your answer…"
          value={replyValue}
          onChange={(e) => setReplyValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          type="button"
          className={styles.clarificationSendButton}
          onClick={handleSend}
          disabled={replyValue.trim().length === 0}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function AgentAnswerPanel({ status, response, error, onReply }: IAgentAnswerPanelProps): JSX.Element | null {
  if (status !== 'done' || response === null || error !== null) {
    return null;
  }

  if (isClarificationResponse(response)) {
    return <ClarificationReply question={response.answer} onReply={onReply} />;
  }

  return null;
}
