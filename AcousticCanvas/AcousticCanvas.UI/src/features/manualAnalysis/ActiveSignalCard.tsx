import type { JSX, RefObject } from 'react';
import { Text, Group, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { WaveSurferDisplay } from '../waveform/WaveSurferDisplay';
import type { WaveSurferDisplayRef } from '../waveform/WaveSurferDisplay';
import { ComparisonView } from '../comparison/ComparisonView';
import { FindingsPanel } from '../findings/FindingsPanel';
import { SpectrogramPanel } from '../analysis/SpectrogramPanel';
import { SpectrumPanel } from '../analysis/SpectrumPanel';
import { CpbPanel } from '../analysis/CpbPanel';
import { SoundQualityPanel } from '../analysis/SoundQualityPanel';
import type { CompareResult } from '../agent/agentToolTypes';
import type { AudioFile } from '../../store/projectState';
import type { WaveformSelection } from '../waveform/waveformSelectionSlice';
import styles from './ActiveSignalCard.module.scss';

interface ToolPanel {
  id: string;
  type: 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
  fileId: string | null;
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
  isFindingsPanelOpen: boolean;
  onWaveSurferReady: () => void;
  onWaveSurferTimeUpdate: (time: number) => void;
  onWaveSurferFinish: () => void;
  onWaveSurferUserSelectionChange: (startSeconds: number, endSeconds: number) => void;
  onCloseComparisonPanel: () => void;
  onCloseFindingsPanel: () => void;
  onToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
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
  isFindingsPanelOpen,
  onWaveSurferReady,
  onWaveSurferTimeUpdate,
  onWaveSurferFinish,
  onWaveSurferUserSelectionChange,
  onCloseComparisonPanel,
  onCloseFindingsPanel,
  onToolPanelFileSelect,
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

      {manualCompareResult !== null && (
        <div className={styles.comparisonPanel}>
          <div className={styles.comparisonPanelHeader}>
            <span className={styles.comparisonPanelTitle}>A/B Comparison</span>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onCloseComparisonPanel}
              aria-label="Close comparison panel"
            >
              <IconX size={12} />
            </ActionIcon>
          </div>
          {manualCompareStatus === 'error' && (
            <div className={styles.comparisonPanelError}>{manualCompareError}</div>
          )}
          <ComparisonView result={manualCompareResult} />
        </div>
      )}

      {isFindingsPanelOpen && (
        <FindingsPanel
          fileId={file.id}
          onClose={onCloseFindingsPanel}
        />
      )}

      {toolPanels.map((panel) => {
        if (panel.type === 'spectrogram') {
          return (
          <SpectrogramPanel
            key={panel.id}
            panelId={panel.id}
            availableFiles={allFiles}
            selectedFileId={panel.fileId}
            currentTimeSeconds={currentTime ?? 0}
            onSeek={onSeek}
            onFileSelect={onToolPanelFileSelect}
            onClose={onToolPanelClose}
          />
          );
        }

        if (panel.type === 'cpb') {
          return (
            <CpbPanel
              key={panel.id}
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
            />
          );
        }

        if (panel.type === 'soundQuality') {
          return (
            <SoundQualityPanel
              key={panel.id}
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
            />
          );
        }

        return (
          <SpectrumPanel
            key={panel.id}
            panelId={panel.id}
            availableFiles={allFiles}
            selectedFileId={panel.fileId}
            onFileSelect={onToolPanelFileSelect}
            onClose={onToolPanelClose}
          />
        );
      })}

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
