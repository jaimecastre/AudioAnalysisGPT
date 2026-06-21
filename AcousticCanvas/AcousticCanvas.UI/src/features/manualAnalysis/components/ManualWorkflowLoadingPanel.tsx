import type { JSX } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import styles from './ManualWorkflowLoadingPanel.module.scss';

interface IManualWorkflowLoadingPanelProps {
  title: string;
  description: string;
  className?: string;
}

export const ManualWorkflowLoadingPanel = ({
  title,
  description,
  className,
}: IManualWorkflowLoadingPanelProps): JSX.Element => {
  const classNames = [styles.workflowLoadingPanel, className].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      role="status"
      aria-live="polite"
    >
      <span className={styles.workflowLoadingIcon}>
        <IconLoader2 size={18} />
      </span>
      <span className={styles.workflowLoadingText}>
        <span className={styles.workflowLoadingTitle}>{title}</span>
        <span className={styles.workflowLoadingDescription}>{description}</span>
      </span>
    </div>
  );
};
