import type { JSX, KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import { Loader, Modal, Text } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconX, IconBulb, IconChevronRight } from '@tabler/icons-react';
import { useAppSelector, useAppDispatch } from '../../../store/reduxHooks';
import {
  runFindingsAnalysis,
  findingsResultSelector,
  findingsStatusSelector,
  findingsErrorSelector,
  findingsClear,
} from '../store/findingsSlice';
import type { Finding, FindingSeverity } from '../types/findingsTypes';
import { agentPromptPrefillSet, setActiveMode } from '../../navigation/store/navigationSlice';
import styles from './FindingsPanel.module.scss';

interface IFindingsPanelProps {
  fileId: string | null;
  onClose: () => void;
}

function SeverityIcon({ severity }: { severity: FindingSeverity }): JSX.Element {
  if (severity === 'high') {
    return <IconAlertTriangle size={14} className={styles.severityIconHigh} />;
  }
  if (severity === 'medium') {
    return <IconAlertCircle size={14} className={styles.severityIconMedium} />;
  }
  return <IconInfoCircle size={14} className={styles.severityIconLow} />;
}

function SeverityBadge({ severity }: { severity: FindingSeverity }): JSX.Element {
  const classMap: Record<FindingSeverity, string> = {
    high: styles.badgeHigh,
    medium: styles.badgeMedium,
    low: styles.badgeLow,
  };
  return (
    <span className={`${styles.severityBadge} ${classMap[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }): JSX.Element {
  const isObserved = confidence === 'observed';
  return (
    <span className={`${styles.confidenceBadge} ${isObserved ? styles.confidenceObserved : styles.confidenceInferred}`}>
      {confidence}
    </span>
  );
}

function EvidenceChip({ label, value }: { label: string; value: unknown }): JSX.Element {
  const displayValue = value === null || value === undefined ? '—' : String(value);
  return (
    <span className={styles.evidenceChip}>
      <span className={styles.evidenceChipLabel}>{label}</span>
      <span className={styles.evidenceChipValue}>{displayValue}</span>
    </span>
  );
}

function formatTimeRange(finding: Finding): string {
  if (finding.startSeconds === null || finding.endSeconds === null) return 'Full file';
  return `${finding.startSeconds.toFixed(3)}s - ${finding.endSeconds.toFixed(3)}s`;
}

function formatFrequency(frequencyHz: number | null): string {
  if (frequencyHz === null || !isFinite(frequencyHz)) return '—';
  if (frequencyHz >= 1000) return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  return `${frequencyHz.toFixed(1)} Hz`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FindingCard({ finding, onOpen }: { finding: Finding; onOpen: (finding: Finding) => void }): JSX.Element {
  const evidenceEntries = Object.entries(finding.evidence);
  const previewEvidence = evidenceEntries.slice(0, 3);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(finding);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.findingCard} ${styles[`findingCard_${finding.severity}`]}`}
      onClick={() => onOpen(finding)}
      onKeyDown={handleKeyDown}
      aria-label={`Open finding details for ${finding.title}`}
    >
      <div className={styles.findingCardHeader}>
        <div className={styles.findingCardTitleRow}>
          <SeverityIcon severity={finding.severity} />
          <span className={styles.findingCardTitle}>{finding.title}</span>
        </div>
        <div className={styles.findingCardBadges}>
          <SeverityBadge severity={finding.severity} />
          <ConfidenceBadge confidence={finding.confidence} />
          <IconChevronRight size={13} className={styles.findingCardOpenIcon} />
        </div>
      </div>

      <p className={styles.findingCardDescription}>{finding.description}</p>

      {previewEvidence.length > 0 && (
        <div className={styles.findingCardEvidence}>
          {previewEvidence.map(([key, value]) => (
            <EvidenceChip key={key} label={key} value={value} />
          ))}
          {evidenceEntries.length > previewEvidence.length && (
            <span className={styles.evidenceMore}>+{evidenceEntries.length - previewEvidence.length}</span>
          )}
        </div>
      )}
    </div>
  );
}

function FindingDetailDialog({
  finding,
  opened,
  onClose,
}: {
  finding: Finding | null;
  opened: boolean;
  onClose: () => void;
}): JSX.Element {
  const evidenceEntries = finding === null ? [] : Object.entries(finding.evidence);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={finding?.title ?? 'Finding details'}
      size="720px"
      centered
      classNames={{
        content: styles.findingDialogContent,
        header: styles.findingDialogHeader,
        title: styles.findingDialogTitle,
        body: styles.findingDialogBody,
        close: styles.findingDialogClose,
      }}
    >
      {finding !== null && (
        <div className={styles.findingDialog}>
          <div className={styles.findingDialogMetaRow}>
            <SeverityBadge severity={finding.severity} />
            <ConfidenceBadge confidence={finding.confidence} />
            <span className={styles.findingDialogType}>{finding.type}</span>
          </div>

          <p className={styles.findingDialogDescription}>{finding.description}</p>

          <div className={styles.findingDialogGrid}>
            <div className={styles.findingDialogMetric}>
              <span className={styles.findingDialogMetricLabel}>Location</span>
              <span className={styles.findingDialogMetricValue}>{formatTimeRange(finding)}</span>
            </div>
            <div className={styles.findingDialogMetric}>
              <span className={styles.findingDialogMetricLabel}>Frequency</span>
              <span className={styles.findingDialogMetricValue}>{formatFrequency(finding.frequencyHz)}</span>
            </div>
            <div className={styles.findingDialogMetric}>
              <span className={styles.findingDialogMetricLabel}>Generated</span>
              <span className={styles.findingDialogMetricValue}>{formatTimestamp(finding.generatedAt)}</span>
            </div>
          </div>

          {evidenceEntries.length > 0 && (
            <section className={styles.findingDialogSection}>
              <h3 className={styles.findingDialogSectionTitle}>Evidence</h3>
              <div className={styles.findingDialogEvidence}>
                {evidenceEntries.map(([key, value]) => (
                  <EvidenceChip key={key} label={key} value={value} />
                ))}
              </div>
            </section>
          )}

          <section className={styles.findingDialogNextStep}>
            <IconBulb size={14} className={styles.findingCardNextStepIcon} />
            <div>
              <h3 className={styles.findingDialogSectionTitle}>Suggested next step</h3>
              <p className={styles.findingDialogNextStepText}>{finding.suggestedNextStep}</p>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

export const FindingsPanel = ({ fileId, onClose }: IFindingsPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const findingsResult = useAppSelector(findingsResultSelector);
  const findingsStatus = useAppSelector(findingsStatusSelector);
  const findingsError = useAppSelector(findingsErrorSelector);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [lastSeenFileId, setLastSeenFileId] = useState(fileId);

  if (lastSeenFileId !== fileId) {
    setLastSeenFileId(fileId);
    setSelectedFinding(null);
  }

  useEffect(() => {
    if (fileId !== null) {
      dispatch(runFindingsAnalysis(fileId));
    }
    return () => {
      dispatch(findingsClear());
    };
  }, [dispatch, fileId]);

  const isLoading = findingsStatus === 'running';
  const hasResult = findingsStatus === 'complete' && findingsResult !== null;
  const hasNoFindings = hasResult && findingsResult!.findingCount === 0;
  const hasFindings = hasResult && findingsResult!.findingCount > 0;

  return (
    <div className={styles.findingsPanel}>
      <div className={styles.findingsPanelHeader}>
        <span className={styles.findingsPanelTitle}>Findings</span>
        {hasResult && (
          <span className={styles.findingsPanelCount}>
            {findingsResult!.findingCount} {findingsResult!.findingCount === 1 ? 'issue' : 'issues'}
          </span>
        )}
        {hasFindings && (
          <button
            type="button"
            className={styles.findingsAskAgentButton}
            onClick={() => {
              dispatch(agentPromptPrefillSet('Summarise and explain the detected findings. What are the highest severity issues and what do they mean for audio quality?'));
              dispatch(setActiveMode('agent'));
            }}
            title="Ask agent about these findings"
          >
            Explain these findings →
          </button>
        )}
        <button
          type="button"
          className={styles.findingsPanelCloseButton}
          onClick={onClose}
          aria-label="Close findings panel"
        >
          <IconX size={12} />
        </button>
      </div>

      <div className={styles.findingsPanelBody}>
        {isLoading && (
          <div className={styles.findingsPanelLoading}>
            <Loader size={16} color="teal" />
            <Text size="xs" c="dimmed">Analysing file…</Text>
          </div>
        )}

        {findingsStatus === 'error' && (
          <div className={styles.findingsPanelError}>
            <IconAlertCircle size={14} />
            <Text size="xs" c="red">{findingsError ?? 'Findings analysis failed.'}</Text>
          </div>
        )}

        {hasNoFindings && (
          <div className={styles.findingsPanelEmpty}>
            <Text size="xs" c="dimmed">No issues detected in this file.</Text>
          </div>
        )}

        {hasFindings && (
          <div className={styles.findingsList}>
            {findingsResult!.findings.map((finding) => (
              <FindingCard key={finding.findingId} finding={finding} onOpen={setSelectedFinding} />
            ))}
          </div>
        )}
      </div>

      <FindingDetailDialog
        finding={selectedFinding}
        opened={selectedFinding !== null}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
};
