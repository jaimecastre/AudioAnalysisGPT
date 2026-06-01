import type { JSX } from 'react';
import { useState } from 'react';
import { Loader } from '@mantine/core';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import { AnalysisInspector } from '../analysis/AnalysisInspector';
import type { AnalysisResult } from '../analysis/analysisTypes';
import type { AnalysisStatus } from '../analysis/analysisSlice';
import styles from './RightSidebar.module.scss';

interface RightSidebarProps {
  analysisResult: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  selectedFileName: string | null;
}

export const RightSidebar = ({
  analysisResult,
  analysisStatus,
  analysisError,
  selectedFileName,
}: RightSidebarProps): JSX.Element => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelIsLoading = analysisStatus === 'running';

  const handleToggleCollapse = (): void => {
    setIsCollapsed((previous) => !previous);
  };

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      {isCollapsed ? (
        <button
          className={styles.toggleButton}
          onClick={handleToggleCollapse}
          type="button"
          aria-label="Expand inspector"
        >
          <IconChevronLeft size={14} />
        </button>
      ) : (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <span className={styles.panelTitle}>Inspector</span>
              {selectedFileName && (
                <span className={styles.panelSubtitle}>{selectedFileName}</span>
              )}
            </div>
            <div className={styles.panelHeaderRight}>
              {panelIsLoading && <Loader size={12} color="teal" />}
              <button
                className={styles.toggleButton}
                onClick={handleToggleCollapse}
                type="button"
                aria-label="Collapse inspector"
              >
                <IconChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className={styles.panelContent}>
            <AnalysisInspector
              result={analysisResult}
              status={analysisStatus}
              error={analysisError}
            />
          </div>
        </div>
      )}
    </div>
  );
};
