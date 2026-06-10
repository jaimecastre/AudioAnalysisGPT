import type { JSX, RefObject } from 'react';
import { Text, Group, ActionIcon } from '@mantine/core';
import { IconX, IconGitCompare } from '@tabler/icons-react';
import { WaveSurferDisplay } from '../waveform/WaveSurferDisplay';
import type { WaveSurferDisplayRef } from '../waveform/WaveSurferDisplay';
import { ComparisonView } from '../comparison/ComparisonView';
import { BatchBenchmarkPanel } from '../batchBenchmark/BatchBenchmarkPanel';
import { FindingsPanel } from '../findings/FindingsPanel';
import { SpectrogramPanel } from '../analysis/SpectrogramPanel';
import { SpectrumPanel } from '../analysis/SpectrumPanel';
import { CpbPanel } from '../analysis/CpbPanel';
import { SoundQualityPanel } from '../analysis/SoundQualityPanel';
import type { CompareResult } from '../agent/agentToolTypes';
import type { BatchBenchmarkResult } from '../batchBenchmark/batchBenchmarkTypes';
import type { AudioFile } from '../../store/projectState';
import type { WaveformSelection } from '../waveform/waveformSelectionSlice';
import styles from './ActiveSignalCard.module.scss';

interface ToolPanel {
  id: string;
  type: 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
  fileId: string | null;
  span: 'normal' | 'wide';
}

interface ActiveSignalCardProps {
  file: AudioFile;
  audioUrl: string;
  waveSurferRef: RefObject<WaveSurferDisplayRef | null>;
  currentTime: number | null;
  activeSelection: WaveformSelection | null;
  toolPanels: ToolPanel[];
  allFiles: AudioFile[];
  manualCompareResult: CompareResult | null;
  manualCompareStatus: 'idle' | 'loading' | 'error';
  manualCompareError: string | null;
  manualBenchmarkResult: BatchBenchmarkResult | null;
  manualBenchmarkStatus: 'idle' | 'loading' | 'error';
  manualBenchmarkError: string | null;
  isBenchmarkPanelOpen: boolean;
  isFindingsPanelOpen: boolean;
  onWaveSurferReady: (audioDuration: number) => void;
  onWaveSurferTimeUpdate: (time: number) => void;
  onWaveSurferFinish: () => void;
  onWaveSurferUserSelectionChange: (startSeconds: number, endSeconds: number) => void;
  onCloseComparisonPanel: () => void;
  onRerunCompare: () => void;
  onRerunBenchmark: () => void;
  onCloseBenchmarkPanel: () => void;
  onCloseFindingsPanel: () => void;
  onToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
  onToolPanelToggleSpan: (panelId: string) => void;
  onToolPanelClose: (panelId: string) => void;
  onSeek: (timeSeconds: number) => void;
}

export function ActiveSignalCard({
  file,
  audioUrl,
  waveSurferRef,
  currentTime,
  activeSelection,
  toolPanels,
  allFiles,
  manualCompareResult,
  manualCompareStatus,
  manualCompareError,
  manualBenchmarkResult,
  manualBenchmarkStatus,
  manualBenchmarkError,
  isBenchmarkPanelOpen,
  isFindingsPanelOpen,
  onWaveSurferReady,
  onWaveSurferTimeUpdate,
  onWaveSurferFinish,
  onWaveSurferUserSelectionChange,
  onCloseComparisonPanel,
  onRerunCompare,
  onRerunBenchmark,
  onCloseBenchmarkPanel,
  onCloseFindingsPanel,
  onToolPanelFileSelect,
  onToolPanelToggleSpan,
  onToolPanelClose,
  onSeek,
}: ActiveSignalCardProps): JSX.Element {
  return (
    <div className={`${styles.signalCard} ${styles.signalCardSelected}`}>
      <div className={styles.signalCardHeader}>
        <span className={styles.signalCardLabel}>{file.name}</span>
      </div>
      <div className={styles.signalCardBody}>
        <WaveSurferDisplay
          fileId={file.id}
          audioUrl={audioUrl}
          onReady={onWaveSurferReady}
          onTimeUpdate={onWaveSurferTimeUpdate}
          onFinish={onWaveSurferFinish}
          onUserSelectionChange={onWaveSurferUserSelectionChange}
          displayRef={waveSurferRef}
        />
      </div>

      <div className={styles.analysisGrid}>
      {manualCompareResult !== null && (
        <div className={`${styles.comparisonPanel} ${styles.gridSpanFull}`}>
          <div className={styles.comparisonPanelHeader}>
            <span className={styles.comparisonPanelTitle}>A/B Comparison</span>
            <Group gap={4}>
              <ActionIcon
                variant="subtle"
                color="blue"
                size="xs"
                onClick={onRerunCompare}
                aria-label="Change files and re-run comparison"
                title="Change files"
              >
                <IconGitCompare size={12} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={onCloseComparisonPanel}
                aria-label="Close comparison panel"
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>
          </div>
          {manualCompareStatus === 'error' && (
            <div className={styles.comparisonPanelError}>{manualCompareError}</div>
          )}
          <ComparisonView result={manualCompareResult} />
        </div>
      )}

      {isBenchmarkPanelOpen && (
        <div className={styles.gridSpanFull}>
          <BatchBenchmarkPanel
            result={manualBenchmarkResult}
            status={manualBenchmarkStatus}
            error={manualBenchmarkError}
            onRerun={onRerunBenchmark}
            onClose={onCloseBenchmarkPanel}
          />
        </div>
      )}

      {isFindingsPanelOpen && (
        <div className={styles.gridSpanFull}>
          <FindingsPanel
            fileId={file.id}
            onClose={onCloseFindingsPanel}
          />
        </div>
      )}

      {toolPanels.map((panel) => {
        const isWide = panel.span === 'wide';
        const wrapperClassName = isWide ? styles.gridSpanFull : undefined;

        let panelElement: JSX.Element;
        if (panel.type === 'spectrogram') {
          panelElement = (
            <SpectrogramPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              currentTimeSeconds={currentTime ?? 0}
              onSeek={onSeek}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else if (panel.type === 'cpb') {
          panelElement = (
            <CpbPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else if (panel.type === 'soundQuality') {
          panelElement = (
            <SoundQualityPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else {
          panelElement = (
            <SpectrumPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        }

        return (
          <div key={panel.id} className={wrapperClassName}>
            {panelElement}
          </div>
        );
      })}
      </div>

      {activeSelection && activeSelection.endSeconds > activeSelection.startSeconds && (
        <div className={styles.regionInfoBar}>
          <Group gap="xs">
            <Text size="xs" c="dimmed">Region:</Text>
            <Text size="xs" fw={500}>
              {activeSelection.startSeconds.toFixed(3)}s – {activeSelection.endSeconds.toFixed(3)}s
            </Text>
            <Text size="xs" c="dimmed">
              ({(activeSelection.endSeconds - activeSelection.startSeconds).toFixed(3)}s)
            </Text>
          </Group>
        </div>
      )}
    </div>
  );
}
