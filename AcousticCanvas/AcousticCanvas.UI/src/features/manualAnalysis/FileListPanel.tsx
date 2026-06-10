import type { JSX } from 'react';
import { useState } from 'react';
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
} from '@tabler/icons-react';
import type { AudioFile } from '../../store/projectState';
import styles from './FileListPanel.module.scss';

interface FileListPanelProps {
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

export function FileListPanel({
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
  hasSpectrogramPanel,
  hasSpectrumPanel,
  hasCpbPanel,
  hasSoundQualityPanel,
  isCompareLoading,
  hasBenchmarkPanel,
  isBenchmarkLoading,
  isFindingsPanelOpen,
  width,
}: FileListPanelProps): JSX.Element {
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());

  function handleToggleExpanded(fileId: string): void {
    setExpandedFileIds((previousSet) => {
      const nextSet = new Set(previousSet);
      if (nextSet.has(fileId)) {
        nextSet.delete(fileId);
      } else {
        nextSet.add(fileId);
      }
      return nextSet;
    });
  }

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
          <Tooltip label={hasSpectrogramPanel ? 'Spectrogram panel already open' : 'Add spectrogram'} withArrow position="right">
            <button
              type="button"
              className={styles.toolRow}
              onClick={onAddSpectrogram}
              disabled={hasSpectrogramPanel}
              aria-label="Add spectrogram panel"
            >
              <span className={styles.toolRowIcon}><IconWaveSine size={18} /></span>
              <Text size="xs" c="dimmed">Spectrogram</Text>
            </button>
          </Tooltip>
          <Tooltip label={hasSpectrumPanel ? 'Spectrum panel already open' : 'Add spectrum'} withArrow position="right">
            <button
              type="button"
              className={styles.toolRow}
              onClick={onAddSpectrum}
              disabled={hasSpectrumPanel}
              aria-label="Add spectrum panel"
            >
              <span className={styles.toolRowIcon}><IconChartLine size={18} /></span>
              <Text size="xs" c="dimmed">Spectrum</Text>
            </button>
          </Tooltip>
          <Tooltip label={hasCpbPanel ? 'CPB panel already open' : 'Add CPB analysis'} withArrow position="right">
            <button
              type="button"
              className={styles.toolRow}
              onClick={onAddCpb}
              disabled={hasCpbPanel}
              aria-label="Add CPB panel"
            >
              <span className={styles.toolRowIcon}><IconChartBar size={18} /></span>
              <Text size="xs" c="dimmed">CPB (1/3 octave)</Text>
            </button>
          </Tooltip>
          <Tooltip label={hasSoundQualityPanel ? 'Sound-quality panel already open' : 'Add sound-quality metrics'} withArrow position="right">
            <button
              type="button"
              className={styles.toolRow}
              onClick={onAddSoundQuality}
              disabled={hasSoundQualityPanel}
              aria-label="Add sound-quality panel"
            >
              <span className={styles.toolRowIcon}><IconSparkles size={18} /></span>
              <Text size="xs" c="dimmed">Sound quality</Text>
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
              <Text size="xs" c="dimmed">A/B compare</Text>
            </button>
          </Tooltip>
          <Tooltip
            label={files.length < 2 ? 'Need at least 2 files to benchmark' : hasBenchmarkPanel ? 'Benchmark already open' : 'Run benchmark'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowBlue}`}
              onClick={onRunBenchmark}
              disabled={files.length < 2 || hasBenchmarkPanel || isBenchmarkLoading}
              aria-label="Run batch benchmark"
            >
              <span className={styles.toolRowIcon}>
                {isBenchmarkLoading ? <IconLoader2 size={18} className={styles.spinIcon} /> : <IconTable size={18} />}
              </span>
              <Text size="xs" c="dimmed">Benchmark</Text>
            </button>
          </Tooltip>
          <Tooltip
            label={isFindingsPanelOpen ? 'Findings panel already open' : 'Analyse findings'}
            withArrow
            position="right"
          >
            <button
              type="button"
              className={`${styles.toolRow} ${styles.toolRowOrange}`}
              onClick={onOpenFindings}
              disabled={isFindingsPanelOpen}
              aria-label="Open findings panel"
            >
              <span className={styles.toolRowIcon}><IconBug size={18} /></span>
              <Text size="xs" c="dimmed">Findings</Text>
            </button>
          </Tooltip>
        </Stack>
      </div>
    </div>
  );
}
