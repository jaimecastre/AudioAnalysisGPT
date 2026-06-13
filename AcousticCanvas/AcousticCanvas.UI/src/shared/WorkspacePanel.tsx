import type { JSX, ReactNode } from 'react';
import styles from './WorkspacePanel.module.scss';

interface IWorkspacePanelProps {
  title: string;
  children: ReactNode;
  as?: 'div' | 'aside' | 'section';
  ariaLabel?: string;
}

export const WorkspacePanel = ({ title, children, as: Tag = 'div', ariaLabel }: IWorkspacePanelProps): JSX.Element => {
  return (
    <Tag className={styles.panel} aria-label={ariaLabel ?? title}>
      <WorkspacePanelHeader title={title} />
      <div className={styles.panelContent}>
        {children}
      </div>
    </Tag>
  );
};

interface IWorkspacePanelHeaderProps {
  title: string;
}

const WorkspacePanelHeader = ({ title }: IWorkspacePanelHeaderProps): JSX.Element => {
  return (
    <div className={styles.panelHeader}>
      <span className={styles.panelTitle}>{title}</span>
    </div>
  );
};

export const WorkspacePanelEmptyHint = ({ text }: { text: string }): JSX.Element => {
  return (
    <div className={styles.emptyHintContainer}>
      <span className={styles.emptyHint}>{text}</span>
    </div>
  );
};

export const WorkspacePanelCanvas = (): JSX.Element => {
  return <div className={styles.panelCanvas} aria-hidden="true" />;
};
