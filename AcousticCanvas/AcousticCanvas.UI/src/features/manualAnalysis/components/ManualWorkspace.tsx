import type { JSX, ChangeEvent } from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioFileDropzone } from '../../audioUpload/components/AudioFileDropzone';
import { setActiveView } from '../../navigation/store/navigationSlice';
import { useAudioUpload } from '../../audioUpload/hooks/useAudioUpload';
import { TransportUI } from '../../playback/components/TransportUI';
import { apiClient } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import { useAppSelector, useAppDispatch } from '../../../store/reduxHooks';
import { projectFilesSelector, selectedSignalIdSelector } from '../../project/store/projectSlice';
import { setLoopEnabled, loopEnabledSelector, activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRepeat, IconX, IconUpload, IconRobot, IconSelectAll } from '@tabler/icons-react';
import { callCompareTool } from '../../agent/services/compareToolService';
import type { CompareResult } from '../../agent/types/agentToolTypes';
import { CompareFilePickerModal } from '../../comparison/components/CompareFilePickerModal';
import { clampCompareSelection } from '../../comparison/utils/compareSelection';
import {
  BenchmarkFilePickerModal,
  canRunBenchmarkWithSelection,
  benchmarkPanelClosed,
  benchmarkResultSelector,
  benchmarkStatusSelector,
  benchmarkErrorSelector,
  benchmarkIsPanelOpenSelector,
  useBatchBenchmark,
} from '../../batchBenchmark';
import { RightSidebar } from './RightSidebar';
import { FileListPanel } from './FileListPanel';
import { ActiveSignalCard } from './ActiveSignalCard';
import { ChatPanel } from '../../agentAnalysis/components/ChatPanel';
import { analysisResultSelector, analysisStatusSelector, analysisErrorSelector } from '../../analysis/store/analysisSlice';
import { spectrumResultSelector } from '../../analysis/store/spectrumSlice';
import { findingsResultSelector as findingsSelector, findingsStatusSelector } from '../../findings/store/findingsSlice';
import { useManualPlayback } from '../../shell/hooks/useManualPlayback';
import { useToolPanels } from '../../shell/hooks/useToolPanels';
import { useResizablePanel } from '../../shell/hooks/useResizablePanel';
import { useKeyboardShortcuts, SEEK_STEP_SECONDS } from '../../shell/hooks/useKeyboardShortcuts';
import styles from './ManualWorkspace.module.scss';

export const ManualWorkspace = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const files = useAppSelector(projectFilesSelector);
  const selectedSignalId = useAppSelector(selectedSignalIdSelector);
  const loopEnabled = useAppSelector(loopEnabledSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const analysisResult = useAppSelector(analysisResultSelector);
  const analysisStatus = useAppSelector(analysisStatusSelector);
  const analysisError = useAppSelector(analysisErrorSelector);
  const spectrumResult = useAppSelector(spectrumResultSelector);
  const findingsResult = useAppSelector(findingsSelector);
  const findings = findingsResult?.findings ?? [];
  const findingsStatus = useAppSelector(findingsStatusSelector);

  const { isUploading, uploadFiles } = useAudioUpload();
  const { panelWidth: leftPanelWidth, handleDragHandleMouseDown } = useResizablePanel(220);
  const {
    toolPanels,
    hasSpectrogramPanel,
    hasSpectrumPanel,
    hasCpbPanel,
    hasSoundQualityPanel,
    handleAddSpectrogramPanel,
    handleAddSpectrumPanel,
    handleAddCpbPanel,
    handleAddSoundQualityPanel,
    handleToolPanelFileSelect,
    handleToolPanelToggleSpan,
    handleToolPanelClose,
  } = useToolPanels(selectedSignalId);
  const {
    waveSurferRef,
    isPlaying,
    currentTime,
    duration,
    handleWaveSurferReady,
    handleWaveSurferTimeUpdate,
    handleWaveSurferFinish,
    handlePlay,
    handlePause,
    handleSeek,
    handleSelectFile,
    handleRemoveFile,
  } = useManualPlayback(selectedSignalId);

  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [manualCompareResult, setManualCompareResult] = useState<CompareResult | null>(null);
  const [manualCompareStatus, setManualCompareStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [manualCompareError, setManualCompareError] = useState<string | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [lastCompareSelectedIds, setLastCompareSelectedIds] = useState<Set<string>>(() => new Set());
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [lastBenchmarkSelectedIds, setLastBenchmarkSelectedIds] = useState<Set<string>>(() => new Set());
  const manualBenchmarkResult = useAppSelector(benchmarkResultSelector);
  const manualBenchmarkStatus = useAppSelector(benchmarkStatusSelector);
  const manualBenchmarkError = useAppSelector(benchmarkErrorSelector);
  const isBenchmarkPanelOpen = useAppSelector(benchmarkIsPanelOpenSelector);
  const [isFindingsPanelOpen, setIsFindingsPanelOpen] = useState(false);
  const { runBenchmark } = useBatchBenchmark();

  const getInitialCompareSelection = useCallback((): Set<string> => {
    const availableIds = new Set(files.map((file) => file.id));
    const persisted = new Set<string>();

    for (const fileId of lastCompareSelectedIds) {
      if (availableIds.has(fileId)) {
        persisted.add(fileId);
      }
    }

    if (persisted.size > 0) {
      return clampCompareSelection(persisted);
    }

    const defaults: string[] = [];
    if (selectedSignalId && availableIds.has(selectedSignalId)) {
      defaults.push(selectedSignalId);
    }
    for (const file of files) {
      if (defaults.length >= 2) {
        break;
      }
      if (!defaults.includes(file.id)) {
        defaults.push(file.id);
      }
    }

    return new Set(defaults);
  }, [files, lastCompareSelectedIds, selectedSignalId]);

  const getInitialBenchmarkSelection = useCallback((): Set<string> => {
    const availableIds = new Set(files.map((file) => file.id));
    const persisted = new Set<string>();

    for (const fileId of lastBenchmarkSelectedIds) {
      if (availableIds.has(fileId)) {
        persisted.add(fileId);
      }
    }

    if (persisted.size >= 2) {
      return persisted;
    }

    return new Set(files.map((file) => file.id));
  }, [files, lastBenchmarkSelectedIds]);

  const handleFilesSelected = async (files: File[]): Promise<void> => {
    const results = await uploadFiles(files);
    if (results.length > 0) {
      dispatch(setActiveView('import'));
    }
  };

  const handleAddFileClick = (): void => {
    addFileInputRef.current?.click();
  };

  const handleAddFileInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selected = Array.from(event.target.files ?? []);
    if (event.target) event.target.value = '';
    if (selected.length > 0) {
      await uploadFiles(selected);
    }
  };

  const handleAddSpectrogramPanelForActiveFile = (): void => {
    handleAddSpectrogramPanel(selectedSignalId);
  };

  const handleAddSpectrumPanelForActiveFile = (): void => {
    handleAddSpectrumPanel(selectedSignalId);
    if (!activeSelection && duration > 0) {
      waveSurferRef.current?.setSelection(0, duration);
    }
  };

  const handleAddCpbPanelForActiveFile = (): void => {
    handleAddCpbPanel(selectedSignalId);
  };

  const handleAddSoundQualityPanelForActiveFile = (): void => {
    handleAddSoundQualityPanel(selectedSignalId);
  };

  const handleToggleLoop = (): void => {
    dispatch(setLoopEnabled(!loopEnabled));
  };

  const handleClearSelection = (): void => {
    waveSurferRef.current?.clearSelection();
  };

  const handleZoomToSelection = (startSeconds: number, endSeconds: number): void => {
    waveSurferRef.current?.zoomToSelection(startSeconds, endSeconds);
  };

  const handleResetWaveformZoom = (): void => {
    waveSurferRef.current?.resetZoom();
  };

  const handleSelectWholeFile = (): void => {
    if (duration <= 0) {
      return;
    }
    waveSurferRef.current?.setSelection(0, duration);
  };

  const handleKeyboardPlayPause = (): void => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleKeyboardSeekBackward = (): void => {
    if (currentTime !== null) {
      handleSeek(Math.max(0, currentTime - SEEK_STEP_SECONDS));
    }
  };

  const handleKeyboardSeekForward = (): void => {
    if (currentTime !== null && duration !== null) {
      handleSeek(Math.min(duration, currentTime + SEEK_STEP_SECONDS));
    }
  };

  useKeyboardShortcuts({
    isEnabled: files.length > 0,
    onPlayPause: handleKeyboardPlayPause,
    onSeekBackward: handleKeyboardSeekBackward,
    onSeekForward: handleKeyboardSeekForward,
    onClearSelection: handleClearSelection,
  });

  // Tracks the last selection that WaveSurfer itself reported (from user drag/resize).
  // Updated via handleWaveSurferUserSelectionChange whenever the user interacts with the waveform.
  // Used in the sync effect below to skip re-pushing WaveSurfer's own changes back into it.
  const lastWaveSurferSelectionRef = useRef<{ startSeconds: number; endSeconds: number } | null>(null);

  const handleWaveSurferUserSelectionChange = (startSeconds: number, endSeconds: number): void => {
    lastWaveSurferSelectionRef.current = { startSeconds, endSeconds };
  };

  useEffect(() => {
    if (!activeSelection || activeSelection.endSeconds <= activeSelection.startSeconds) {
      return;
    }

    const lastFromWaveSurfer = lastWaveSurferSelectionRef.current;
    const alreadyMatchesWaveSurfer = lastFromWaveSurfer !== null
      && Math.abs(lastFromWaveSurfer.startSeconds - activeSelection.startSeconds) < 0.001
      && Math.abs(lastFromWaveSurfer.endSeconds - activeSelection.endSeconds) < 0.001;

    if (alreadyMatchesWaveSurfer) return;

    waveSurferRef.current?.setSelection(activeSelection.startSeconds, activeSelection.endSeconds);
    lastWaveSurferSelectionRef.current = { startSeconds: activeSelection.startSeconds, endSeconds: activeSelection.endSeconds };
  // waveSurferRef is a stable ref — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSelection]);

  const handleToggleAgentPanel = (): void => {
    setIsAgentPanelOpen((previous) => !previous);
  };

  const handleOpenCompareModal = (): void => {
    setIsCompareModalOpen(true);
  };

  const handleCloseCompareModal = (): void => {
    setIsCompareModalOpen(false);
  };

  const handleOpenBenchmarkModal = (): void => {
    setIsBenchmarkModalOpen(true);
  };

  const handleCloseBenchmarkModalConfig = (): void => {
    setIsBenchmarkModalOpen(false);
  };

  const handleRunManualCompare = async (fileIds: string[]): Promise<void> => {
    if (fileIds.length !== 2) return;
    setLastCompareSelectedIds(new Set(fileIds));
    setIsCompareModalOpen(false);
    setManualCompareStatus('loading');
    setManualCompareError(null);
    try {
      const result = await callCompareTool({
        fileIds,
        startSeconds: null,
        endSeconds: null,
      });
      setManualCompareResult(result);
      setManualCompareStatus('idle');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compare failed';
      setManualCompareError(errorMessage);
      setManualCompareStatus('error');
    }
  };

  const handleCloseComparisonPanel = (): void => {
    setManualCompareResult(null);
    setManualCompareStatus('idle');
    setManualCompareError(null);
  };

  const handleRunManualBenchmark = async (fileIds: string[]): Promise<void> => {
    if (!canRunBenchmarkWithSelection(new Set(fileIds))) {
      return;
    }

    setLastBenchmarkSelectedIds(new Set(fileIds));
    setIsBenchmarkModalOpen(false);

    await runBenchmark({
      fileIds,
      startSeconds: activeSelection?.startSeconds ?? null,
      endSeconds: activeSelection?.endSeconds ?? null,
    });
  };

  const handleCloseBenchmarkPanel = (): void => {
    dispatch(benchmarkPanelClosed());
  };

  const handleOpenFindingsPanel = (): void => {
    setIsFindingsPanelOpen(true);
  };

  const handleCloseFindingsPanel = (): void => {
    setIsFindingsPanelOpen(false);
  };

  return (
    <div className={styles.workspaceWithFileList}>
      {files.length === 0 && (
        <div className={styles.workspace}>
          <AudioFileDropzone onFileSelected={handleFilesSelected} isUploading={isUploading} />
        </div>
      )}
      {files.length > 0 && (
        <>
          <FileListPanel
            files={files}
            selectedSignalId={selectedSignalId}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
            onAddFileClick={handleAddFileClick}
            onAddSpectrogram={handleAddSpectrogramPanelForActiveFile}
            onAddSpectrum={handleAddSpectrumPanelForActiveFile}
            onAddCpb={handleAddCpbPanelForActiveFile}
            onAddSoundQuality={handleAddSoundQualityPanelForActiveFile}
            hasSpectrogramPanel={hasSpectrogramPanel}
            hasSpectrumPanel={hasSpectrumPanel}
            hasCpbPanel={hasCpbPanel}
            hasSoundQualityPanel={hasSoundQualityPanel}
            isCompareLoading={manualCompareStatus === 'loading'}
            onRunCompare={handleOpenCompareModal}
            hasBenchmarkPanel={isBenchmarkPanelOpen}
            isBenchmarkLoading={manualBenchmarkStatus === 'loading'}
            onRunBenchmark={handleOpenBenchmarkModal}
            isFindingsPanelOpen={isFindingsPanelOpen}
            onOpenFindings={handleOpenFindingsPanel}
            width={leftPanelWidth}
          />
          <div
            className={styles.panelDragHandle}
            onMouseDown={handleDragHandleMouseDown}
            role="separator"
            aria-label="Resize left panel"
          />
          <input
            ref={addFileInputRef}
            type="file"
            accept=".wav,.mp3,.flac,.aiff,.aif"
            multiple
            style={{ display: 'none' }}
            onChange={handleAddFileInputChange}
            aria-label="Add audio files"
          />
          <div className={styles.contentRow}>
            <div className={styles.mainArea}>
              <div
                className={styles.signalViewport}
                onDragOver={(event) => { event.preventDefault(); setIsDraggingFileOver(true); }}
                onDragLeave={() => setIsDraggingFileOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingFileOver(false);
                  const droppedFiles = Array.from(event.dataTransfer.files);
                  if (droppedFiles.length > 0) void uploadFiles(droppedFiles);
                }}
                style={{ position: 'relative' }}
              >
                {isDraggingFileOver && (
                  <div className={styles.dropAcceptOverlay}>
                    <IconUpload size={32} />
                    <span>Drop to add file</span>
                  </div>
                )}
                {files.map((file) => {
                  const isActive = file.id === selectedSignalId;
                  const fileAudioUrl = apiClient.buildUrl(API_ENDPOINTS.AUDIO.GET_FILE(file.id));

                  if (!isActive) {
                    return (
                      <div
                        key={file.id}
                        className={styles.signalCardInactive}
                        onClick={() => handleSelectFile(file.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFile(file.id); }}
                        aria-label={`Switch to ${file.name}`}
                      >
                        <span className={styles.signalCardInactiveName} title={file.name}>{file.name}</span>
                        <span className={styles.signalCardInactiveDetail}>
                          {file.durationSeconds.toFixed(2)}s · {(file.sampleRate / 1000).toFixed(1)} kHz · {file.channels}ch
                        </span>
                        <span className={styles.signalCardInactiveHint}>click to load</span>
                      </div>
                    );
                  }

                  return (
                    <ActiveSignalCard
                      key={file.id}
                      file={file}
                      audioUrl={fileAudioUrl}
                      waveSurferRef={waveSurferRef}
                      currentTime={currentTime}
                      activeSelection={activeSelection}
                      toolPanels={toolPanels}
                      allFiles={files}
                      manualCompareResult={manualCompareResult}
                      manualCompareStatus={manualCompareStatus}
                      manualCompareError={manualCompareError}
                      manualBenchmarkResult={manualBenchmarkResult}
                      manualBenchmarkStatus={manualBenchmarkStatus}
                      manualBenchmarkError={manualBenchmarkError}
                      isBenchmarkPanelOpen={isBenchmarkPanelOpen}
                      isFindingsPanelOpen={isFindingsPanelOpen}
                      showInvestigationPrompt={
                        toolPanels.length === 0 &&
                        !isFindingsPanelOpen &&
                        !isBenchmarkPanelOpen &&
                        manualCompareResult === null
                      }
                      analysisResult={analysisResult}
                      spectrumResult={spectrumResult}
                      findings={findings}
                      findingsStatus={findingsStatus}
                      onPromptOpenFindings={handleOpenFindingsPanel}
                      onPromptAddSpectrum={handleAddSpectrumPanelForActiveFile}
                      onPromptAddCpb={handleAddCpbPanelForActiveFile}
                      onPromptAddSoundQuality={handleAddSoundQualityPanelForActiveFile}
                      onWaveSurferReady={handleWaveSurferReady}
                      onWaveSurferTimeUpdate={handleWaveSurferTimeUpdate}
                      onWaveSurferFinish={handleWaveSurferFinish}
                      onWaveSurferUserSelectionChange={handleWaveSurferUserSelectionChange}
                      onCloseComparisonPanel={handleCloseComparisonPanel}
                      onRerunCompare={handleOpenCompareModal}
                      onRerunBenchmark={handleOpenBenchmarkModal}
                      onCloseBenchmarkPanel={handleCloseBenchmarkPanel}
                      onCloseFindingsPanel={handleCloseFindingsPanel}
                      onClearWaveformSelection={handleClearSelection}
                      onZoomToSelection={handleZoomToSelection}
                      onResetWaveformZoom={handleResetWaveformZoom}
                      onToolPanelFileSelect={handleToolPanelFileSelect}
                      onToolPanelToggleSpan={handleToolPanelToggleSpan}
                      onToolPanelClose={handleToolPanelClose}
                      onSeek={handleSeek}
                    />
                  );
                })}
              </div>
              <div className={styles.transportBar}>
                <TransportUI
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  isLoading={false}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeek={handleSeek}
                  secondaryControls={
                    <>
                      <Tooltip label={loopEnabled ? 'Loop: on' : 'Loop: off'} withArrow position="top">
                        <ActionIcon
                          variant={loopEnabled ? 'filled' : 'subtle'}
                          color={loopEnabled ? 'teal' : 'gray'}
                          size="sm"
                          onClick={handleToggleLoop}
                          aria-label="Toggle loop"
                        >
                          <IconRepeat size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {!activeSelection && duration > 0 && (
                        <Tooltip label="Select whole file" withArrow position="top">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={handleSelectWholeFile}
                            aria-label="Select whole file"
                          >
                            <IconSelectAll size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {activeSelection && (
                        <Tooltip label="Clear selection" withArrow position="top">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={handleClearSelection}
                            aria-label="Clear selection"
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </>
                  }
                />
              </div>
            </div>
          </div>
          <RightSidebar
            analysisResult={analysisResult}
            analysisStatus={analysisStatus}
            analysisError={analysisError}
            selectedFileName={files.find((f) => f.id === selectedSignalId)?.name ?? null}
          />
          <div
            className={`${styles.agentPanelColumn} ${isAgentPanelOpen ? styles.agentPanelColumnOpen : ''}`}
          >
            <ChatPanel />
          </div>
          <button
            type="button"
            className={`${styles.agentPanelToggle} ${isAgentPanelOpen ? styles.agentPanelToggleActive : ''}`}
            onClick={handleToggleAgentPanel}
            title={isAgentPanelOpen ? 'Close agent panel' : 'Open agent panel'}
            aria-label={isAgentPanelOpen ? 'Close agent panel' : 'Open agent panel'}
          >
            <IconRobot size={16} />
          </button>
          <CompareFilePickerModal
            opened={isCompareModalOpen}
            onClose={handleCloseCompareModal}
            files={files}
            initialSelectedIds={getInitialCompareSelection()}
            onConfirm={handleRunManualCompare}
            isLoading={manualCompareStatus === 'loading'}
          />
          <BenchmarkFilePickerModal
            opened={isBenchmarkModalOpen}
            onClose={handleCloseBenchmarkModalConfig}
            files={files}
            initialSelectedIds={getInitialBenchmarkSelection()}
            onConfirm={handleRunManualBenchmark}
            isLoading={manualBenchmarkStatus === 'loading'}
          />
        </>
      )}
    </div>
  );
};
