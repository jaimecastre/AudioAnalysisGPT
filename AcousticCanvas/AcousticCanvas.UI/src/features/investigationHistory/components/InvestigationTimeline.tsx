import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconClock, IconRotateClockwise } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { agentPromptPrefillSet } from '../../navigation/store/navigationSlice';
import {
  focusedInvestigationRecordIdSelector,
  investigationRecordsSelector,
  recordFocused,
} from '../store/investigationHistorySlice';
import type { InvestigationRecord } from '../types/investigationHistoryTypes';
import styles from './InvestigationTimeline.module.scss';

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getToolLabel = (toolName: string): string => {
  return toolName.replace(/^run_/, '').replace(/^get_/, '').replace(/_/g, ' ');
};

const TimelineRecord = ({
  record,
  expanded,
  focused,
  onToggle,
}: {
  record: InvestigationRecord;
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
}): JSX.Element => {
  const dispatch = useAppDispatch();
  const recordRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focused || !recordRef.current) {
      return;
    }

    recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focused]);

  const handleReAsk = (): void => {
    dispatch(agentPromptPrefillSet(record.question));
  };

  const tools = record.toolsRun.length > 0 ? record.toolsRun : record.plannedTools ?? [];

  return (
    <div
      ref={recordRef}
      className={`${styles.timelineRecord} ${focused ? styles.timelineRecordFocused : ''}`}
      data-investigation-record-id={record.id}
    >
      <button
        type="button"
        className={styles.recordSummary}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.recordRail} />
        <span className={styles.expandIcon}>
          {expanded ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />}
        </span>
        <span className={styles.recordMain}>
          <span className={styles.recordTimestamp}>
            <IconClock size={10} />
            {formatTimestamp(record.timestamp)}
          </span>
          <span className={styles.recordQuestion}>{record.question}</span>
          <span className={styles.toolPills}>
            {tools.slice(0, 4).map((toolName) => (
              <span key={toolName} className={styles.toolPill}>{getToolLabel(toolName)}</span>
            ))}
            {tools.length > 4 && <span className={styles.toolPill}>+{tools.length - 4}</span>}
          </span>
        </span>
        <span className={`${styles.confidenceBadge} ${styles[`confidence_${record.confidence}`] ?? ''}`}>
          {CONFIDENCE_LABELS[record.confidence] ?? record.confidence}
        </span>
      </button>

      {expanded && (
        <div className={styles.recordDetail}>
          <p className={styles.answerSummary}>{record.answer}</p>
          {record.limitations && record.limitations.length > 0 && (
            <div className={styles.limitations}>
              {record.limitations.map((limitation) => (
                <span key={limitation} className={styles.limitationPill}>{limitation}</span>
              ))}
            </div>
          )}
          <button
            type="button"
            className={styles.reAskButton}
            onClick={handleReAsk}
          >
            <IconRotateClockwise size={11} />
            Re-ask
          </button>
        </div>
      )}
    </div>
  );
};

export const InvestigationTimeline = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const records = useAppSelector(investigationRecordsSelector);
  const focusedRecordId = useAppSelector(focusedInvestigationRecordIdSelector);
  const [openPreference, setOpenPreference] = useState<'auto' | 'open' | 'closed'>('auto');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const isOpen = focusedRecordId !== null
    || openPreference === 'open'
    || (openPreference === 'auto' && records.length > 0);

  const handleRecordToggle = (recordId: string): void => {
    dispatch(recordFocused(recordId));
    setExpandedRecordIds((previous) => {
      const next = new Set(previous);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const handleTimelineToggle = (): void => {
    setOpenPreference(isOpen ? 'closed' : 'open');
  };

  return (
    <section className={styles.timelinePanel}>
      <button
        type="button"
        className={styles.timelineHeader}
        onClick={handleTimelineToggle}
        aria-expanded={isOpen}
      >
        {isOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        <span className={styles.timelineTitle}>Investigation timeline</span>
        <span className={styles.timelineCount}>{records.length}</span>
      </button>

      {isOpen && (
        <div className={styles.timelineBody}>
          {records.length === 0 ? (
            <p className={styles.emptyState}>Agent investigations will appear here after a question is answered.</p>
          ) : (
            records.map((record) => (
              <TimelineRecord
                key={record.id}
                record={record}
                expanded={expandedRecordIds.has(record.id) || focusedRecordId === record.id}
                focused={focusedRecordId === record.id}
                onToggle={() => handleRecordToggle(record.id)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
};
