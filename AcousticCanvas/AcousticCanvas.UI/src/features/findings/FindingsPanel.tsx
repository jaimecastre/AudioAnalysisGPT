import type { JSX } from 'react';
import { useEffect } from 'react';
import { Loader, Text } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconX, IconBulb } from '@tabler/icons-react';
import { useAppSelector, useAppDispatch } from '../../store/reduxHooks';
import {
  runFindingsAnalysis,
  findingsResultSelector,
  findingsStatusSelector,
  findingsErrorSelector,
  findingsClear,
} from './findingsSlice';
import type { Finding, FindingSeverity } from './findingsTypes';
import styles from './FindingsPanel.module.scss';

interface FindingsPanelProps {
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

function FindingCard({ finding }: { finding: Finding }): JSX.Element {
  const evidenceEntries = Object.entries(finding.evidence);
  const hasTimeRange = finding.startSeconds !== null && finding.endSeconds !== null;

  return (
    <div className={`${styles.findingCard} ${styles[`findingCard_${finding.severity}`]}`}>
      <div className={styles.findingCardHeader}>
        <div className={styles.findingCardTitleRow}>
          <SeverityIcon severity={finding.severity} />
          <span className={styles.findingCardTitle}>{finding.title}</span>
        </div>
        <div className={styles.findingCardBadges}>
          <SeverityBadge severity={finding.severity} />
          <ConfidenceBadge confidence={finding.confidence} />
        </div>
      </div>

      <p className={styles.findingCardDescription}>{finding.description}</p>

      {hasTimeRange && (
        <div className={styles.findingCardTimeRange}>
          <span className={styles.findingCardTimeLabel}>Location:</span>
          <span className={styles.findingCardTimeValue}>
            {finding.startSeconds!.toFixed(3)}s – {finding.endSeconds!.toFixed(3)}s
          </span>
        </div>
      )}

      {evidenceEntries.length > 0 && (
        <div className={styles.findingCardEvidence}>
          {evidenceEntries.map(([key, value]) => (
            <EvidenceChip key={key} label={key} value={value} />
          ))}
        </div>
      )}

      <div className={styles.findingCardNextStep}>
        <IconBulb size={12} className={styles.findingCardNextStepIcon} />
        <span className={styles.findingCardNextStepText}>{finding.suggestedNextStep}</span>
      </div>
    </div>
  );
}

export const FindingsPanel = ({ fileId, onClose }: FindingsPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const findingsResult = useAppSelector(findingsResultSelector);
  const findingsStatus = useAppSelector(findingsStatusSelector);
  const findingsError = useAppSelector(findingsErrorSelector);

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
              <FindingCard key={finding.findingId} finding={finding} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
