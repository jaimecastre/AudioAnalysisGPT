import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import { Text } from '@mantine/core';
import {
  IconArrowUp, IconEraser, IconRobot, IconTool, IconCheck, IconX,
  IconAlignBoxLeftMiddle, IconPaperclip, IconFileMusic, IconFileText,
  IconPlayerStop, IconUser, IconWaveSquare, IconChartBar, IconFileSearch,
  IconVolume,
} from '@tabler/icons-react';
import type { ToolStep } from '../store/chatSlice';
import type { ChatMessage } from '../store/chatSlice';
import { AGENT_MODELS } from '../utils/agentModels';
import { AgentActivityIndicator } from './AgentActivityIndicator';
import { AgentResponseBlockRenderer } from './AgentResponseBlockRenderer';
import { BlockSkeleton } from './BlockSkeleton';
import { ATTACH_ACCEPT } from '../utils/chatAttachments';
import { AgentAnswerPanel } from './AgentAnswerPanel';
import type { MentionCandidate } from '../hooks/useChatInput';
import { useChatPanel, useSelectionChip } from '../hooks/useChatPanel';
import styles from './ChatPanel.module.scss';

const SUGGESTION_PROMPTS: { text: string; icon: typeof IconWaveSquare }[] = [
  { text: 'What is the peak level of the loaded file?', icon: IconVolume },
  { text: 'Detect findings and issues in the loaded file.', icon: IconFileSearch },
  { text: 'Run a spectrum analysis on the current selection.', icon: IconWaveSquare },
  { text: 'Show me the file format and sample rate.', icon: IconChartBar },
];

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


function UserMessage({ message }: { message: ChatMessage }): JSX.Element {
  return (
    <div className={`${styles.messageWrapper} ${styles.user}`}>
      <div className={styles.avatarIcon}>
        <IconUser size={14} />
      </div>
      <div className={styles.messageContent}>
        <div className={styles.messageBody}>{message.content}</div>
        <span className={styles.messageTime}>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }): JSX.Element {
  const parsedText = message.content;
  const isThinkingMessage = message.status === 'thinking';
  const isFailedMessage = message.status === 'failed';
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isGeneratingBlocks = !isThinkingMessage && !hasBlocks && message.toolSteps && message.toolSteps.length > 0 && message.toolSteps.every(s => s.status === 'completed');

  return (
    <div className={`${styles.messageWrapper} ${styles.assistant}`}>
      <div className={styles.avatarIcon}>
        <IconRobot size={14} />
      </div>
      <div className={`${styles.messageContent} ${isFailedMessage ? styles.failedMessage : ''}`}>
        {isThinkingMessage ? (
          <AgentActivityIndicator activityLabel={message.activityLabel ?? 'planning'} />
        ) : (
          <>
            <div className={styles.markdownBody}>
              <ReactMarkdown>{parsedText}</ReactMarkdown>
            </div>
            {isGeneratingBlocks && (
              <>
                <Text size="sm" c="dimmed" mt="sm" mb="xs">
                  Generating visual response...
                </Text>
                <BlockSkeleton count={2} />
              </>
            )}
            {hasBlocks && (
              <AgentResponseBlockRenderer blocks={message.blocks} answerText={message.content} />
            )}
            {message.toolSteps && message.toolSteps.length > 0 && (
              <AnalysisSteps steps={message.toolSteps} confidence={message.confidence} />
            )}
          </>
        )}
        {!isThinkingMessage && (
          <span className={styles.messageTime}>{formatTimestamp(message.timestamp)}</span>
        )}
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

const TOOL_LABELS: Record<string, string> = {
  get_metadata: 'Read metadata',
  run_basic_metrics: 'Measure levels (RMS, peak, crest factor)',
  run_event_detection: 'Detect events (clipping / silence / transients)',
  run_spectrum: 'Compute FFT spectrum',
  run_spectrogram: 'Compute spectrogram',
  run_cpb: 'Compute CPB bands (1/3 octave)',
  run_sound_quality_metrics: 'Compute psychoacoustic metrics (MoSQITo)',
  run_findings: 'Run findings pipeline',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

function PlanMessage({ message }: { message: ChatMessage }): JSX.Element {
  const tools = message.plannedTools ?? [];
  const isPlanning = message.planStatus === 'planning';
  return (
    <div className={styles.planRow}>
      <div className={styles.planRowInner}>
        {isPlanning ? (
          <span className={styles.planLabelThinking}>
            <span className={styles.inlineSpinner} />
            <span>Thinking…</span>
          </span>
        ) : (
          <>
            <span className={styles.planLabel}>Analysing:</span>
            {tools.length > 0 && (
              <span className={styles.planTools}>
                {tools.map((tool, index) => (
                  <span key={`${tool}-${index}`} className={styles.planToolTag}>{TOOL_LABELS[tool] ?? tool}</span>
                ))}
              </span>
            )}
          </>
        )}
      </div>
      {!isPlanning && message.plannerReason && (
        <details className={styles.planReasonDetails}>
          <summary className={styles.planReasonSummary}>Why these analyses</summary>
          <p className={styles.planReason}>{message.plannerReason}</p>
        </details>
      )}
    </div>
  );
}

function AnalysisSteps({ steps, confidence }: { steps: ToolStep[]; confidence?: string }): JSX.Element {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const failed = steps.filter((s) => s.status === 'failed').length;

  const summaryText = failed > 0
    ? `${completed} analyses run · ${failed} failed`
    : `${completed} ${completed === 1 ? 'analysis' : 'analyses'} run`;

  return (
    <details className={styles.analysisSteps}>
      <summary className={styles.analysisStepsSummary}>
        <span className={styles.analysisStepsLabel}>Analysis steps</span>
        <span className={styles.analysisStepsCount}>{summaryText}</span>
        {confidence && (
          <span className={`${styles.confidenceBadge} ${styles[`confidence_${confidence}`] ?? ''}`}>
            {CONFIDENCE_LABELS[confidence] ?? confidence}
          </span>
        )}
      </summary>
      <ol className={styles.analysisStepsList}>
        {steps.map((step, index) => (
          <li
            key={index}
            className={`${styles.analysisStep} ${step.status === 'failed' ? styles.analysisStepFailed : ''}`}
          >
            <span className={styles.analysisStepIcon}>
              {step.status === 'completed' ? <IconCheck size={9} /> : <IconX size={9} />}
            </span>
            <span className={styles.analysisStepName}>
              {TOOL_LABELS[step.toolName] ?? step.toolName}
            </span>
            {step.errorMessage && (
              <span className={styles.analysisStepError}>{step.errorMessage}</span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function SelectionChip({ onExplain }: { onExplain: () => void }): JSX.Element | null {
  const { activeSelection, hasValidSelection } = useSelectionChip();

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
      <div className={styles.emptyStateGreeting}>
        <IconRobot size={32} className={styles.emptyStateIcon} />
        <h2 className={styles.emptyStateHeading}>How can I help you?</h2>
        <p className={styles.emptyStateSubtext}>
          Analyse audio, inspect levels, run spectrums, detect events, or ask questions about your files.
        </p>
      </div>
      <div className={styles.emptyStateSuggestions}>
        {SUGGESTION_PROMPTS.map((prompt) => (
          <button
            key={prompt.text}
            className={styles.suggestionCard}
            onClick={() => onSuggestionClick(prompt.text)}
            type="button"
          >
            <prompt.icon size={16} className={styles.suggestionCardIcon} />
            <span className={styles.suggestionCardText}>{prompt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MentionDropdown({
  candidates,
  selectedIndex,
  onSelect,
}: {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
}): JSX.Element {
  return (
    <div className={styles.mentionDropdown}>
      {candidates.map((candidate, index) => (
        <button
          key={candidate.fileId}
          type="button"
          className={`${styles.mentionDropdownItem} ${index === selectedIndex ? styles.mentionDropdownItemSelected : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(candidate);
          }}
        >
          <IconFileMusic size={12} className={styles.mentionDropdownIcon} />
          <span className={styles.mentionDropdownName}>{candidate.fileName}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatPanel(): JSX.Element {
  const {
    messages,
    isThinking,
    selectedModel,
    messageListRef,
    hasMessages,
    agentPanelResponse,
    handleModelChange,
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
    cancelAnalysis,
    agentAskStatus,
    agentAskError,
    handleClarificationReply,
  } = useChatPanel();

  return (
    <div className={styles.panel}>
      <div className={styles.messageList} ref={messageListRef}>
        {!hasMessages && (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        )}
        <div className={styles.messagesContainer}>
          {(() => {
            const hasPlanInProgress = messages.some((m) => m.role === 'plan' && m.planStatus === 'planning');
            return messages.map((message) => {
              if (message.role === 'user') return <UserMessage key={message.id} message={message} />;
              if (message.role === 'tool_call') return <ToolCallMessage key={message.id} message={message} />;
              if (message.role === 'plan') return <PlanMessage key={message.id} message={message} />;
              if (message.status === 'thinking' && hasPlanInProgress) return null;
              return <AssistantMessage key={message.id} message={message} />;
            });
          })()}
          <AgentAnswerPanel
            status={agentAskStatus}
            response={agentPanelResponse}
            error={agentAskError}
            onReply={handleClarificationReply}
          />
        </div>
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputContainer}>
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
          {mentionDropdownCandidates.length > 0 && (
            <MentionDropdown
              candidates={mentionDropdownCandidates}
              selectedIndex={mentionDropdownSelectedIndex}
              onSelect={handleMentionSelect}
            />
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
              placeholder="Ask about your audio…"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                handleCursorChange(e.target.selectionStart ?? e.target.value.length);
              }}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                handleCursorChange(target.selectionStart ?? inputValue.length);
              }}
              onInput={handleTextareaInput}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message input"
            />
            {isThinking ? (
              <button
                type="button"
                className={styles.sendButton}
                onClick={cancelAnalysis}
                aria-label="Cancel analysis"
                title="Cancel analysis"
              >
                <IconPlayerStop size={15} />
              </button>
            ) : (
              <button
                type="button"
                className={styles.sendButton}
                onClick={handleSendMessage}
                disabled={!canSend}
                aria-label="Send message"
              >
                <IconArrowUp size={16} />
              </button>
            )}
          </div>
          <div className={styles.inputFooter}>
            <select
              className={styles.modelSelect}
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isThinking}
              aria-label="Select AI model"
            >
              {AGENT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {hasMessages && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClearConversation}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <IconEraser size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
