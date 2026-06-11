import type { JSX } from 'react';
import { ChatPanel } from './ChatPanel';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { IconGripVertical } from '@tabler/icons-react';
import { useAgentWorkspace } from '../../shell/hooks/useAgentWorkspace';
import styles from './AgentWorkspace.module.scss';

export const AgentWorkspace = (): JSX.Element => {
  const { hasNoFile, handleResizePointerDown, containerRef } = useAgentWorkspace();

  return (
    <div ref={containerRef} className={styles.workspace}>
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
      <div className={styles.rightPanelColumn}>
        <div className={styles.rightPanelResizeHandle} onPointerDown={handleResizePointerDown} role="separator" aria-label="Resize workspace panel" title="Drag to resize workspace panel">
          <IconGripVertical size={12} />
        </div>
        <AgentWorkspacePanel />
      </div>
    </div>
  );
};
