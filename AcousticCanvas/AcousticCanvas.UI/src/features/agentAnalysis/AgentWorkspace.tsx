import type { JSX } from 'react';
import { WorkspacePanel, WorkspacePanelEmptyHint } from '../../shared/WorkspacePanel';
import { ChatPanel } from './ChatPanel';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import styles from './AgentWorkspace.module.scss';

export const AgentWorkspace = (): JSX.Element => {
  return (
    <div className={styles.workspace}>
      <TaskProgressPanel />
      <div className={styles.chatColumn}>
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
