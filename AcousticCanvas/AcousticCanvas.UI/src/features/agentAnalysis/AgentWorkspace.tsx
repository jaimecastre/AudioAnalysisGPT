import type { JSX } from 'react';
import { WorkspacePanel, WorkspacePanelEmptyHint } from '../../shared/WorkspacePanel';
import { ChatPanel } from './ChatPanel';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { useAppSelector } from '../../store/reduxHooks';
import { projectFilesSelector } from '../project/projectSlice';
import styles from './AgentWorkspace.module.scss';

export const AgentWorkspace = (): JSX.Element => {
  const files = useAppSelector(projectFilesSelector);
  const hasNoFile = files.length === 0;

  return (
    <div className={styles.workspace}>
      <TaskProgressPanel />
      <div className={styles.chatColumn}>
        {hasNoFile && (
          <div className={styles.noFileBanner}>
            No file loaded — use the
            {' '}<strong>📎 attach button</strong>{' '}
            below to import audio, or switch to{' '}
            <strong>Manual mode</strong> to open a file.
          </div>
        )}
        <ChatPanel />
      </div>
      <AgentWorkspacePanel />
    </div>
  );
};

const TaskProgressPanel = (): JSX.Element => {
  return (
    <WorkspacePanel title="Tasks" as="aside">
      <WorkspacePanelEmptyHint text="No tasks running" />
    </WorkspacePanel>
  );
};
