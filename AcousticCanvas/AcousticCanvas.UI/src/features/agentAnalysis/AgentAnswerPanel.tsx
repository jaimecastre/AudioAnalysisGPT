import type { JSX, KeyboardEvent } from 'react';
import { useState } from 'react';
import {
  IconBulb,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconTool,
} from '@tabler/icons-react';
import type { AgentAskResponse, AgentToolExecutionRecord } from './services/agentAskService';
import type { AgentAskStatus } from './agentAskSlice';
import styles from './AgentAnswerPanel.module.scss';

interface AgentAnswerPanelProps {
  status: AgentAskStatus;
  response: AgentAskResponse | null;
  error: string | null;
  onReply: (replyText: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: string }): JSX.Element {
  const classMap: Record<string, string> = {
    high: styles.confidenceHigh,
    medium: styles.confidenceMedium,
    low: styles.confidenceLow,
  };
  const badgeClass = classMap[confidence] ?? styles.confidenceLow;
  return (
    <span className={`${styles.confidenceBadge} ${badgeClass}`}>
      {confidence} confidence
    </span>
  );
}

const EVIDENCE_LABEL_MAP: Record<string, string> = {
  ev_meta: 'metadata',
  ev_metrics: 'levels',
  ev_spectrum: 'spectrum',
  ev_cpb: 'CPB bands',
  ev_events: 'events',
  ev_clip: 'clipping',
};

function getEvidenceLabel(evidenceId: string): string {
  for (const prefix of Object.keys(EVIDENCE_LABEL_MAP)) {
    if (evidenceId.startsWith(prefix)) {
      const fileFragment = evidenceId.slice(prefix.length + 1, prefix.length + 9);
      return `${EVIDENCE_LABEL_MAP[prefix]} · ${fileFragment}`;
    }
  }
  return evidenceId;
}

function EvidenceChip({ evidenceId }: { evidenceId: string }): JSX.Element {
  return (
    <span className={styles.evidenceChip} title={evidenceId}>
      {getEvidenceLabel(evidenceId)}
    </span>
  );
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_metadata: 'Metadata',
  run_basic_metrics: 'Level metrics',
  run_spectrum: 'Spectrum',
  run_cpb: 'CPB bands',
  run_event_detection: 'Event detection',
};

function ToolExecutionRow({ toolExecution }: { toolExecution: AgentToolExecutionRecord }): JSX.Element {
  const isCompleted = toolExecution.status === 'completed';
  const displayName = TOOL_DISPLAY_NAMES[toolExecution.toolName] ?? toolExecution.toolName;
  return (
    <div className={styles.toolExecutionRow}>
      <span className={isCompleted ? styles.toolIconSuccess : styles.toolIconFailed}>
        {isCompleted ? <IconCheck size={10} /> : <IconAlertTriangle size={10} />}
      </span>
      <span className={styles.toolName}>{displayName}</span>
      {toolExecution.errorMessage !== null && (
        <span className={styles.toolError}>{toolExecution.errorMessage}</span>
      )}
    </div>
  );
}

function ToolExecutionSection({
  toolExecutions,
  limitations,
}: {
  toolExecutions: AgentToolExecutionRecord[];
  limitations: string[];
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleToggle() {
    setIsExpanded((previous) => !previous);
  }

  const toolCount = toolExecutions.length;
  const label = toolCount > 0
    ? `${toolCount} tool${toolCount !== 1 ? 's' : ''} used`
    : 'Details';

  return (
    <div className={styles.toolExecutionSection}>
      <button className={styles.toolExecutionToggle} onClick={handleToggle} type="button">
        <IconTool size={11} />
        <span>{label}</span>
        {isExpanded ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />}
      </button>
      {isExpanded && (
        <div className={styles.toolExecutionList}>
          {toolExecutions.map((toolExecution) => (
            <ToolExecutionRow key={toolExecution.toolName} toolExecution={toolExecution} />
          ))}
          {limitations.length > 0 && (
            <div className={styles.limitationsInline}>
              {limitations.map((limitation, index) => (
                <div key={index} className={styles.limitationInlineItem}>{limitation}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
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

export function AgentAnswerPanel({ status, response, error, onReply }: AgentAnswerPanelProps): JSX.Element | null {
  if (status === 'idle') {
    return null;
  }

  if (status === 'analyzing') {
    return (
      <div className={styles.analyzingState}>
        <div className={styles.analyzingBubble}>
          <div className={styles.analyzingSpinner} />
          Analyzing request…
        </div>
      </div>
    );
  }

  if (status === 'error' || error !== null) {
    return (
      <div className={styles.errorState}>
        <IconAlertTriangle size={14} className={styles.errorIcon} />
        <span className={styles.errorText}>{error ?? 'An unknown error occurred.'}</span>
      </div>
    );
  }

  if (response === null) {
    return null;
  }

  if (isClarificationResponse(response)) {
    return <ClarificationReply question={response.answer} onReply={onReply} />;
  }

  return (
    <div className={styles.answerPanel}>
      <div className={styles.answerHeader}>
        <ConfidenceBadge confidence={response.confidence} />
        {response.validationWarning && (
          <span className={styles.validationWarning} title="Agent response may contain unsupported claims">
            <IconAlertTriangle size={12} />
          </span>
        )}
      </div>

      <div className={styles.answerText}>
        {response.answer}
      </div>

      {response.evidenceReferences.length > 0 && (
        <div className={styles.evidenceSection}>
          <span className={styles.sectionLabel}>Evidence</span>
          <div className={styles.evidenceChips}>
            {response.evidenceReferences.map((evidenceId) => (
              <EvidenceChip key={evidenceId} evidenceId={evidenceId} />
            ))}
          </div>
        </div>
      )}

      {response.suggestedNextSteps.length > 0 && (
        <div className={styles.nextStepsSection}>
          <span className={styles.sectionLabel}>
            <IconBulb size={11} /> Next steps
          </span>
          <ul className={styles.nextStepsList}>
            {response.suggestedNextSteps.map((step, index) => (
              <li key={index} className={styles.nextStepItem}>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(response.toolExecutions.length > 0 || response.limitations.length > 0) && (
        <ToolExecutionSection
          toolExecutions={response.toolExecutions}
          limitations={response.limitations}
        />
      )}
    </div>
  );
}
