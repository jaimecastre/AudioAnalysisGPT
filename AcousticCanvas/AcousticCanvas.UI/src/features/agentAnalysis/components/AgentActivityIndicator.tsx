import type { JSX } from 'react';
import type { AgentActivityLabel } from '../store/chatSlice';
import styles from './AgentActivityIndicator.module.scss';

const ACTIVITY_LABELS: Record<AgentActivityLabel, string> = {
  planning: 'Planning investigation…',
  running_tools: 'Running analysis tools…',
  building_results: 'Building results…',
  generating_answer: 'Generating answer…',
  complete: 'Done',
  failed: 'Analysis failed',
};

interface IAgentActivityIndicatorProps {
  activityLabel: AgentActivityLabel;
}

export const AgentActivityIndicator = ({ activityLabel }: IAgentActivityIndicatorProps): JSX.Element => {
  const isFailed = activityLabel === 'failed';
  const isComplete = activityLabel === 'complete';
  const isActive = !isFailed && !isComplete;
  const displayText = ACTIVITY_LABELS[activityLabel];

  return (
    <div className={`${styles.activityIndicator} ${isFailed ? styles.failed : ''}`}>
      {isActive && <span className={styles.spinner} />}
      <span className={styles.label}>{displayText}</span>
    </div>
  );
};
