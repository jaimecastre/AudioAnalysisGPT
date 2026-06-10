import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  IconArrowUp, IconEraser, IconRobot, IconTool, IconCheck, IconX,
  IconAlignBoxLeftMiddle, IconPaperclip, IconFileMusic, IconFileText,
  IconPlayerStop, IconUser, IconWaveSquare, IconChartBar, IconFileSearch,
  IconVolume,
} from '@tabler/icons-react';
import type { ToolStep } from './chatSlice';
import type { ChatMessage } from './chatSlice';
import { AGENT_MODELS } from './utils/agentModels';
import { ATTACH_ACCEPT } from './chatAttachments';
import { AgentAnswerPanel } from './AgentAnswerPanel';
import type { MentionCandidate } from './useChatInput';
import type { AgentEvidenceItem } from './utils/evidenceFormatting';
import { getEvidenceLabel } from './utils/evidenceFormatting';
import { getEvidenceArtifactId } from './utils/evidenceArtifactMatching';
import type { AgentArtifact } from './agentWorkspaceSlice';
import { useChatPanel, useAssistantMessage, useSelectionChip } from './hooks/useChatPanel';
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

function getShortArtifactId(id: string): string {
  return id.length > 6 ? id.slice(-6) : id;
}

function parseEvidenceTokens(content: string): string {
  const evidenceRegex = /\[(analysis_result|compare_result|find_result|findings_result|tool_result|report|marker_added|selection_set):([0-9a-fA-F-]{8,})\]/g;
  const withoutTokens = content.replace(evidenceRegex, '');

  return withoutTokens
    .replace(/\n+Evidence:\s*[\s\S]*$/i, '')
    .replace(/^\d+\.\s*$/gm, '')          // remove list items emptied by token stripping
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function EvidenceCitations({
  evidenceReferences,
  evidenceItems,
  artifacts,
  onArtifactClick,
}: {
  evidenceReferences: string[] | undefined;
  evidenceItems: AgentEvidenceItem[] | undefined;
  artifacts: AgentArtifact[];
  onArtifactClick: (evidenceItem: AgentEvidenceItem) => void;
}): JSX.Element | null {
  if (!evidenceReferences || !evidenceItems || evidenceReferences.length === 0) {
    return null;
  }

  const referencedEvidenceItems = evidenceReferences
    .map((referenceId) => evidenceItems.find((item) => item.evidenceId === referenceId) ?? null)
    .filter((item): item is AgentEvidenceItem => item !== null);

  if (referencedEvidenceItems.length === 0) {
    return null;
  }

  return (
    <div className={styles.evidenceCitationSection}>
      <div className={styles.evidenceCitationHeading}>Evidence</div>
      <div className={styles.evidenceCitationList}>
        {referencedEvidenceItems.map((item) => {
          const artifactId = getEvidenceArtifactId(item, artifacts);
          const label = getEvidenceLabel(item.type);
          const fileName = typeof item.data.fileName === 'string' ? item.data.fileName : null;
          const fileNameA = typeof item.data.fileNameA === 'string' ? item.data.fileNameA : null;
          const fileNameB = typeof item.data.fileNameB === 'string' ? item.data.fileNameB : null;
          const subject = fileName ?? (fileNameA && fileNameB ? `${fileNameA} vs ${fileNameB}` : null);

          return (
            artifactId ? (
              <button
                key={item.evidenceId}
                type="button"
                className={styles.evidenceCitationPill}
                onClick={() => onArtifactClick(item)}
                title="Open related workspace artifact"
              >
                <span>{label}</span>
                {subject && <span className={styles.evidenceCitationSubject}>{subject}</span>}
                <span className={styles.evidenceCitationId}>{getShortArtifactId(item.evidenceId)}</span>
              </button>
            ) : (
              <span key={item.evidenceId} className={styles.evidenceCitationPill}>
                <span>{label}</span>
                {subject && <span className={styles.evidenceCitationSubject}>{subject}</span>}
                <span className={styles.evidenceCitationId}>{getShortArtifactId(item.evidenceId)}</span>
              </span>
            )
          );
        })}
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }): JSX.Element {
  const { artifacts, handleEvidenceClick } = useAssistantMessage();
  const parsedText = parseEvidenceTokens(message.content);
  const isThinkingMessage = message.status === 'thinking';
  const isFailedMessage = message.status === 'failed';

  return (
    <div className={`${styles.messageWrapper} ${styles.assistant}`}>
      <div className={styles.avatarIcon}>
        <IconRobot size={14} />
      </div>
      <div className={`${styles.messageContent} ${isFailedMessage ? styles.failedMessage : ''}`}>
        {isThinkingMessage ? (
          <div className={styles.thinkingIndicator}>
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
          </div>
        ) : (
          <>
            <div className={styles.markdownBody}>
              <ReactMarkdown>{parsedText}</ReactMarkdown>
            </div>
            <EvidenceCitations
              evidenceReferences={message.evidenceReferences}
              evidenceItems={message.evidenceItems}
              artifacts={artifacts}
              onArtifactClick={handleEvidenceClick}
            />
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
