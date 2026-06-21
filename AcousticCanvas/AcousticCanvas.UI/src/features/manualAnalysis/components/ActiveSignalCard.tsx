import type { JSX, MouseEvent, RefObject } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Text, Group, ActionIcon } from '@mantine/core';
import {
  IconChartLine,
  IconSearch,
  IconRepeat,
  IconX,
  IconMapPin,
  IconZoomIn,
  IconZoomOut,
  IconClipboard,
  IconGitCompare,
} from '@tabler/icons-react';
import { WaveSurferDisplay } from '../../waveform/components/WaveSurferDisplay';
import type { WaveSurferDisplayRef } from '../../waveform/components/WaveSurferDisplay';
import type { ContextMenuItem } from '../../../shared/components/ContextMenu';
import { ContextMenu } from '../../../shared/components/ContextMenu';
import { useContextMenu } from '../../../shared/hooks/useContextMenu';
import { useAppDispatch } from '../../../store/reduxHooks';
import { addMarker } from '../../project/store/projectSlice';
import { setLoopEnabled } from '../../waveform/store/waveformSelectionSlice';
import { InvestigationStartPrompt } from './InvestigationStartPrompt';
import { ComparisonView } from '../../comparison/components/ComparisonView';
import { BatchBenchmarkPanel } from '../../batchBenchmark';
import { FindingsPanel } from '../../findings/components/FindingsPanel';
import { SpectrogramPanel } from '../../analysis/components/SpectrogramPanel';
import { SpectrumPanel } from '../../analysis/components/SpectrumPanel';
import { CpbPanel } from '../../analysis/components/CpbPanel';
import { SoundQualityPanel } from '../../analysis/components/SoundQualityPanel';
import type { CompareResult } from '../../agent/types/agentToolTypes';
import type { AnalysisResult } from '../../analysis/types/analysisTypes';
import type { SpectrumPointsResponse } from '../../analysis/types/spectrumTypes';
import { KeyFindingsSummary } from './KeyFindingsSummary';
import type { BatchBenchmarkResult } from '../../batchBenchmark';
import type { AudioFile } from '../../../store/projectState';
import type { WaveformSelection } from '../../waveform/store/waveformSelectionSlice';
import type { Finding } from '../../findings/types/findingsTypes';
import type { FindingsStatus } from '../../findings/store/findingsSlice';
import { ManualWorkflowLoadingPanel } from './ManualWorkflowLoadingPanel';
import styles from './ActiveSignalCard.module.scss';

interface IToolPanel {
  id: string;
  type: 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
  fileId: string | null;
  span: 'normal' | 'wide';
}

interface IActiveSignalCardProps {
  file: AudioFile;
  audioUrl: string;
  waveSurferRef: RefObject<WaveSurferDisplayRef | null>;
  currentTime: number | null;
  activeSelection: WaveformSelection | null;
  toolPanels: IToolPanel[];
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
  onClearWaveformSelection: () => void;
  onZoomToSelection: (startSeconds: number, endSeconds: number) => void;
  onResetWaveformZoom: () => void;
  showInvestigationPrompt: boolean;
  onPromptOpenFindings: () => void;
  onPromptAddSpectrum: () => void;
  onPromptAddCpb: () => void;
  onPromptAddSoundQuality: () => void;
  onToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
  onToolPanelToggleSpan: (panelId: string) => void;
  onToolPanelClose: (panelId: string) => void;
  onSeek: (timeSeconds: number) => void;
  analysisResult: AnalysisResult | null;
  spectrumResult: SpectrumPointsResponse | null;
  findings: Finding[];
  findingsStatus: FindingsStatus;
}

export const ActiveSignalCard = ({
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
  onClearWaveformSelection,
  onZoomToSelection,
  onResetWaveformZoom,
  showInvestigationPrompt,
  analysisResult,
  spectrumResult,
  findings,
  findingsStatus,
  onPromptOpenFindings,
  onPromptAddSpectrum,
  onPromptAddCpb,
  onPromptAddSoundQuality,
  onToolPanelFileSelect,
  onToolPanelToggleSpan,
  onToolPanelClose,
  onSeek,
}: IActiveSignalCardProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const [contextMenuTimeSeconds, setContextMenuTimeSeconds] = useState<number | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const hasSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  const handleWaveformContextMenu = useCallback((event: MouseEvent): void => {
    const rightClickTimeSeconds = waveSurferRef.current?.getTimeForClientX(event.clientX) ?? currentTime ?? null;
    setContextMenuTimeSeconds(rightClickTimeSeconds);
    openContextMenu(event);
  }, [currentTime, openContextMenu, waveSurferRef]);

  const handleAnalyzeSelection = useCallback((): void => {
    onPromptAddSpectrum();
    onPromptAddCpb();
    onPromptAddSoundQuality();
  }, [onPromptAddCpb, onPromptAddSoundQuality, onPromptAddSpectrum]);

  const handleFindEventsInSelection = useCallback((): void => {
    onPromptOpenFindings();
  }, [onPromptOpenFindings]);

  const handleSetLoopRegion = useCallback((): void => {
    dispatch(setLoopEnabled(true));
  }, [dispatch]);

  const handleClearSelection = useCallback((): void => {
    onClearWaveformSelection();
  }, [onClearWaveformSelection]);

  const handleCopyTimeRange = useCallback((): void => {
    if (!activeSelection) {
      return;
    }
    const timeRange = `${activeSelection.startSeconds.toFixed(3)}s - ${activeSelection.endSeconds.toFixed(3)}s`;
    void navigator.clipboard.writeText(timeRange);
  }, [activeSelection]);

  const handleAddMarker = useCallback((): void => {
    const markerTimeSeconds = contextMenuTimeSeconds ?? currentTime ?? 0;
    const markerId = `marker-${Date.now()}`;
    dispatch(addMarker({
      id: markerId,
      fileId: file.id,
      timeSeconds: markerTimeSeconds,
      label: `Marker ${markerTimeSeconds.toFixed(3)}s`,
      source: 'manual',
    }));
  }, [contextMenuTimeSeconds, currentTime, dispatch, file.id]);

  const handleZoomToSelection = useCallback((): void => {
    if (!activeSelection) {
      return;
    }
    onZoomToSelection(activeSelection.startSeconds, activeSelection.endSeconds);
  }, [activeSelection, onZoomToSelection]);

  const handleResetZoom = useCallback((): void => {
    onResetWaveformZoom();
  }, [onResetWaveformZoom]);

  const waveformContextMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (hasSelection) {
      items.push(
        {
          id: 'analyze-selection',
          label: 'Analyze selection',
          icon: <IconChartLine size={16} />,
          onSelect: handleAnalyzeSelection,
        },
        {
          id: 'find-events',
          label: 'Find events in selection',
          icon: <IconSearch size={16} />,
          onSelect: handleFindEventsInSelection,
        },
        {
          id: 'set-loop',
          label: 'Set loop region',
          icon: <IconRepeat size={16} />,
          onSelect: handleSetLoopRegion,
        },
        {
          id: 'copy-time-range',
          label: 'Copy time range',
          icon: <IconClipboard size={16} />,
          onSelect: handleCopyTimeRange,
        },
        {
          id: 'clear-selection',
          label: 'Clear selection',
          icon: <IconX size={16} />,
          onSelect: handleClearSelection,
        },
        {
          id: 'selection-divider',
          label: '',
          divider: true,
          onSelect: () => {},
        },
      );
    }

    items.push({
      id: 'add-marker',
      label: 'Add marker at cursor',
      icon: <IconMapPin size={16} />,
      onSelect: handleAddMarker,
    });

    if (hasSelection) {
      items.push({
        id: 'zoom-to-selection',
        label: 'Zoom to selection',
        icon: <IconZoomIn size={16} />,
        onSelect: handleZoomToSelection,
      });
    }

    items.push({
      id: 'reset-zoom',
      label: 'Reset zoom',
      icon: <IconZoomOut size={16} />,
      onSelect: handleResetZoom,
    });

    return items;
  }, [
    hasSelection,
    handleAnalyzeSelection,
    handleFindEventsInSelection,
    handleSetLoopRegion,
    handleClearSelection,
    handleCopyTimeRange,
    handleAddMarker,
    handleZoomToSelection,
    handleResetZoom,
  ]);

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
          onContextMenu={handleWaveformContextMenu}
        />
        <ContextMenu
          opened={contextMenu !== null}
          position={contextMenu}
          items={waveformContextMenuItems}
          onClose={closeContextMenu}
        />
      </div>

      <KeyFindingsSummary
        activeFile={file}
        analysisResult={analysisResult}
        spectrumResult={spectrumResult}
        findings={findings}
        findingsStatus={findingsStatus}
        onViewFindings={onPromptOpenFindings}
        onAnalyzeLoudestRegion={onPromptOpenFindings}
        onInspectSpectrum={onPromptAddSpectrum}
      />

      <div className={styles.analysisGrid}>
      {showInvestigationPrompt && (
        <InvestigationStartPrompt
          onOpenFindings={onPromptOpenFindings}
          onAddSpectrum={onPromptAddSpectrum}
          onAddSoundQuality={onPromptAddSoundQuality}
        />
      )}
      {manualCompareStatus === 'loading' && (
        <ManualWorkflowLoadingPanel
          className={styles.gridSpanFull}
          title="Comparing files"
          description="Building A/B spectrum, band energy, and sound-quality deltas."
        />
      )}

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
            onSeekToTime={onSeek}
            onAnalyzeRegion={handleAnalyzeSelection}
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
};
