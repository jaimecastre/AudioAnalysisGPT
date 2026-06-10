import type { JSX } from 'react';
import { ChatPanel } from './ChatPanel';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { useAppSelector } from '../../store/reduxHooks';
import { projectFilesSelector } from '../project/projectSlice';
import { IconGripVertical } from '@tabler/icons-react';
import { useResizableSidebar } from '../../shared/useResizableSidebar';
import styles from './AgentWorkspace.module.scss';

export const AgentWorkspace = (): JSX.Element => {
  const files = useAppSelector(projectFilesSelector);
  const hasNoFile = files.length === 0;
  const { handleResizePointerDown, containerRef } = useResizableSidebar({ initialWidth: 320, minWidth: 260, maxWidth: 540 });

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
