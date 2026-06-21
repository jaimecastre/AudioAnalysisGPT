import type { JSX, MouseEvent } from 'react';
import { useState, useCallback } from 'react';
import { Text, Stack, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconFileMusic,
  IconWaveSine,
  IconChartLine,
  IconChartBar,
  IconTrash,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
  IconGitCompare,
  IconLoader2,
  IconBug,
  IconSparkles,
  IconTable,
  IconFileText,
} from '@tabler/icons-react';
import type { AudioFile } from '../../../store/projectState';
import styles from './FileListPanel.module.scss';
import { useContextMenu } from '../../../shared/hooks/useContextMenu';
import { ContextMenu } from '../../../shared/components/ContextMenu';
import { buildFileListContextMenuItems } from './FileListContextMenu';
import { FileMetadataModal } from './FileMetadataModal';

interface IFileListPanelProps {
  files: AudioFile[];
  selectedSignalId: string | null;
  onSelectFile: (fileId: string) => void;
  onRemoveFile: (fileId: string) => void;
  onAddFileClick: () => void;
  onAddSpectrogram: () => void;
  onAddSpectrum: () => void;
  onAddCpb: () => void;
  onAddSoundQuality: () => void;
  onRunCompare: () => void;
  onRunBenchmark: () => void;
  onOpenFindings: () => void;
  onExportReport: () => void;
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
  hasCpbPanel: boolean;
  hasSoundQualityPanel: boolean;
  isCompareLoading: boolean;
  hasBenchmarkPanel: boolean;
  isBenchmarkLoading: boolean;
  isFindingsPanelOpen: boolean;
  width: number;
}

export const FileListPanel = ({
  files,
  selectedSignalId,
  onSelectFile,
  onRemoveFile,
  onAddFileClick,
  onAddSpectrogram,
  onAddSpectrum,
  onAddCpb,
  onAddSoundQuality,
  onRunCompare,
  onRunBenchmark,
  onOpenFindings,
  onExportReport,
  hasSpectrogramPanel,
  hasSpectrumPanel,
  hasCpbPanel,
  hasSoundQualityPanel,
  isCompareLoading,
  hasBenchmarkPanel,
  isBenchmarkLoading,
  isFindingsPanelOpen,
  width,
}: IFileListPanelProps): JSX.Element => {
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [contextMenuFileId, setContextMenuFileId] = useState<string | null>(null);
  const [showFileMetadataModal, setShowFileMetadataModal] = useState(false);

  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const handleToggleExpanded = useCallback((fileId: string): void => {
    setExpandedFileIds((previousSet) => {
      const nextSet = new Set(previousSet);
      if (nextSet.has(fileId)) {
        nextSet.delete(fileId);
      } else {
        nextSet.add(fileId);
      }
      return nextSet;
    });
  }, []);

  const handleFileContextMenu = useCallback((event: MouseEvent, fileId: string): void => {
    event.stopPropagation();
    setContextMenuFileId(fileId);
    openContextMenu(event);
  }, [openContextMenu]);

  const handleSelectFileFromMenu = useCallback((): void => {
    if (contextMenuFileId) {
      onSelectFile(contextMenuFileId);
    }
    closeContextMenu();
  }, [contextMenuFileId, onSelectFile, closeContextMenu]);

  const handleCompareWithFromMenu = useCallback((): void => {
    onRunCompare();
    closeContextMenu();
  }, [onRunCompare, closeContextMenu]);

  const handleShowFileInfoFromMenu = useCallback((): void => {
    setShowFileMetadataModal(true);
    closeContextMenu();
  }, [closeContextMenu]);

  const handleRemoveFileFromMenu = useCallback((): void => {
    if (contextMenuFileId) {
      onRemoveFile(contextMenuFileId);
    }
    closeContextMenu();
  }, [contextMenuFileId, onRemoveFile, closeContextMenu]);

  return (
    <div className={styles.fileListPanel} style={{ width }}>
      <Text fw={600} size="sm" mb="md" c="dimmed">FILES</Text>
      {files.map((file) => {
        const isActive = file.id === selectedSignalId;
        const isExpanded = expandedFileIds.has(file.id);
        return (
          <div
            key={file.id}
            className={`${styles.fileTreeNode} ${isActive ? styles.fileTreeNodeActive : ''}`}
            onClick={() => onSelectFile(file.id)}
            onContextMenu={(e) => handleFileContextMenu(e, file.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFile(file.id); }}
          >
            <div className={styles.fileTreeRow}>
              <span
                className={styles.fileTreeChevron}
                onClick={(e) => { e.stopPropagation(); handleToggleExpanded(file.id); }}
                role="button"
                tabIndex={-1}
                aria-label={isExpanded ? 'Collapse channels' : 'Expand channels'}
              >
                {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
              </span>
              <IconFileMusic size={16} className={styles.fileTreeFileIcon} />
              <span className={styles.fileTreeFileName} title={file.name}>
                {file.name}
              </span>
              <Tooltip label="Remove file" withArrow position="right">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={(event) => { event.stopPropagation(); onRemoveFile(file.id); }}
                  aria-label={`Remove ${file.name}`}
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </Tooltip>
            </div>
            {isExpanded && (
              <div className={styles.fileTreeChildren}>
                {Array.from({ length: file.channels }, (_, channelIndex) => (
                  <div key={channelIndex} className={styles.fileTreeChannelRow}>
                    <span className={styles.fileTreeChannelLabel}>
                      Channel {channelIndex + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className={styles.addFileRow} onClick={onAddFileClick}>
        <IconPlus size={12} />
        Add file
      </button>

      <div style={{ marginTop: 24 }}>
        <Text fw={600} size="sm" mb="sm" c="dimmed">TOOLS</Text>
        <Stack gap={6}>
          <Tooltip label={hasSpectrogramPanel ? 'Spectrogram open — visible in workspace' : 'Open spectrogram'} withArrow position="right">
            <button
              type="button"
              className={`${styles.toolRow} ${hasSpectrogramPanel ? styles.toolRowActive : ''}`}
              onClick={onAddSpectrogram}
              aria-label={hasSpectrogramPanel ? 'Spectrogram panel is open' : 'Add spectrogram panel'}
            >
              <span className={styles.toolRowIcon}><IconWaveSine size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>Spectrogram</Text>
              {hasSpectrogramPanel && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip label={hasSpectrumPanel ? 'Spectrum open — visible in workspace' : 'Open spectrum'} withArrow position="right">
            <button
              type="button"
              className={`${styles.toolRow} ${hasSpectrumPanel ? styles.toolRowActive : ''}`}
              onClick={onAddSpectrum}
              aria-label={hasSpectrumPanel ? 'Spectrum panel is open' : 'Add spectrum panel'}
            >
              <span className={styles.toolRowIcon}><IconChartLine size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>Spectrum</Text>
              {hasSpectrumPanel && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip label={hasCpbPanel ? 'CPB open — visible in workspace' : 'Open CPB analysis'} withArrow position="right">
            <button
              type="button"
              className={`${styles.toolRow} ${hasCpbPanel ? styles.toolRowActive : ''}`}
              onClick={onAddCpb}
              aria-label={hasCpbPanel ? 'CPB panel is open' : 'Add CPB panel'}
            >
              <span className={styles.toolRowIcon}><IconChartBar size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>CPB (1/3 octave)</Text>
              {hasCpbPanel && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip label={hasSoundQualityPanel ? 'Sound quality open — visible in workspace' : 'Open sound-quality metrics'} withArrow position="right">
            <button
              type="button"
              className={`${styles.toolRow} ${hasSoundQualityPanel ? styles.toolRowActive : ''}`}
              onClick={onAddSoundQuality}
              aria-label={hasSoundQualityPanel ? 'Sound quality panel is open' : 'Add sound-quality panel'}
            >
              <span className={styles.toolRowIcon}><IconSparkles size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>Sound quality</Text>
              {hasSoundQualityPanel && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip
            label={files.length < 2 ? 'Need at least 2 files to compare' : 'Compare files'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowBlue}`}
              onClick={onRunCompare}
              disabled={files.length < 2 || isCompareLoading}
              aria-label="Run A/B comparison"
            >
              <span className={styles.toolRowIcon}>
                {isCompareLoading ? <IconLoader2 size={18} className={styles.spinIcon} /> : <IconGitCompare size={18} />}
              </span>
              <Text size="xs" className={styles.toolRowLabel}>A/B compare</Text>
            </button>
          </Tooltip>
          <Tooltip
            label={files.length < 2 ? 'Need at least 2 files to benchmark' : hasBenchmarkPanel ? 'Benchmark open — visible in workspace' : 'Run benchmark'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowBlue} ${hasBenchmarkPanel ? styles.toolRowActive : ''}`}
              onClick={onRunBenchmark}
              disabled={files.length < 2 || isBenchmarkLoading}
              aria-label={hasBenchmarkPanel ? 'Benchmark panel is open' : 'Run batch benchmark'}
            >
              <span className={styles.toolRowIcon}>
                {isBenchmarkLoading ? <IconLoader2 size={18} className={styles.spinIcon} /> : <IconTable size={18} />}
              </span>
              <Text size="xs" className={styles.toolRowLabel}>Benchmark</Text>
              {hasBenchmarkPanel && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip
            label={isFindingsPanelOpen ? 'Findings open — visible in workspace' : 'Detect findings'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowOrange} ${isFindingsPanelOpen ? styles.toolRowActive : ''}`}
              onClick={onOpenFindings}
              aria-label={isFindingsPanelOpen ? 'Findings panel is open' : 'Open findings panel'}
            >
              <span className={styles.toolRowIcon}><IconBug size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>Findings</Text>
              {isFindingsPanelOpen && <span className={styles.toolRowBadge}>Open</span>}
            </button>
          </Tooltip>
          <Tooltip
            label={files.length === 0 ? 'Load a file to export a report' : 'Export session report as Markdown'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowTeal}`}
              onClick={onExportReport}
              disabled={files.length === 0}
              aria-label="Export session report"
            >
              <span className={styles.toolRowIcon}><IconFileText size={18} /></span>
              <Text size="xs" className={styles.toolRowLabel}>Export Report</Text>
            </button>
          </Tooltip>
        </Stack>
      </div>
      {contextMenuFileId && (
        <ContextMenu
          opened={contextMenu !== null}
          position={contextMenu}
          items={buildFileListContextMenuItems({
            fileId: contextMenuFileId,
            isSelected: contextMenuFileId === selectedSignalId,
            canCompare: files.length >= 2,
            onSelectFile: handleSelectFileFromMenu,
            onCompareWith: handleCompareWithFromMenu,
            onShowFileInfo: handleShowFileInfoFromMenu,
            onRemoveFile: handleRemoveFileFromMenu,
          })}
          onClose={closeContextMenu}
        />
      )}
      <FileMetadataModal
        file={files.find((f) => f.id === contextMenuFileId) ?? null}
        opened={showFileMetadataModal}
        onClose={() => setShowFileMetadataModal(false)}
      />
    </div>
  );
};
