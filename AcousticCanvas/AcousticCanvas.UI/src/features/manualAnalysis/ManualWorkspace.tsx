import type { JSX, ChangeEvent } from 'react';
import { useRef, useState, useEffect } from 'react';
import { AudioFileDropzone } from '../audioUpload/AudioFileDropzone';
import { setActiveView } from '../navigation/navigationSlice';
import { useAudioUpload } from '../audioUpload/useAudioUpload';
import { TransportUI } from '../playback/TransportUI';
import { WaveSurferDisplay } from '../waveform/WaveSurferDisplay';
import { apiClient } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { useAppSelector, useAppDispatch } from '../../store/reduxHooks';
import {
  projectFilesSelector,
  selectedSignalIdSelector,
} from '../project/projectSlice';
import type { AudioFile } from '../../store/projectState';
import {
  setLoopEnabled,
  loopEnabledSelector,
  activeSelectionSelector,
} from '../waveform/waveformSelectionSlice';
import { Text, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconRepeat, IconX, IconFileMusic, IconWaveSine, IconChartLine, IconTrash, IconUpload, IconRobot, IconPlus, IconChevronDown, IconChevronRight, IconGitCompare, IconLoader2 } from '@tabler/icons-react';
import { ComparisonView } from '../comparison/ComparisonView';
import { callCompareTool } from '../agent/services/compareToolService';
import type { CompareResult } from '../agent/agentToolTypes';
import { RightSidebar } from './RightSidebar';
import { ChatPanel } from '../agentAnalysis/ChatPanel';
import {
  analysisResultSelector,
  analysisStatusSelector,
  analysisErrorSelector,
} from '../analysis/analysisSlice';
import { SpectrogramPanel } from '../analysis/SpectrogramPanel';
import { SpectrumPanel } from '../analysis/SpectrumPanel';
import { useManualPlayback } from './useManualPlayback';
import { useToolPanels } from './useToolPanels';
import { useResizablePanel } from './useResizablePanel';
import { useKeyboardShortcuts, SEEK_STEP_SECONDS } from './useKeyboardShortcuts';
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

  const { isUploading, uploadFile, uploadFiles } = useAudioUpload();
  const { panelWidth: leftPanelWidth, handleDragHandleMouseDown } = useResizablePanel(220);
  const {
    toolPanels,
    hasSpectrogramPanel,
    hasSpectrumPanel,
    handleAddSpectrogramPanel,
    handleAddSpectrumPanel,
    handleToolPanelFileSelect,
    handleToolPanelClose,
  } = useToolPanels();
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
  };

  const handleToggleLoop = (): void => {
    dispatch(setLoopEnabled(!loopEnabled));
  };

  const handleClearSelection = (): void => {
    waveSurferRef.current?.clearSelection();
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

  const handleRunManualCompare = async (): Promise<void> => {
    if (files.length < 2) return;
    setManualCompareStatus('loading');
    setManualCompareError(null);
    try {
      const result = await callCompareTool({
        fileIds: files.map((file) => file.id),
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
            hasSpectrogramPanel={hasSpectrogramPanel}
            hasSpectrumPanel={hasSpectrumPanel}
            hasComparisonPanel={manualCompareResult !== null}
            isCompareLoading={manualCompareStatus === 'loading'}
            onRunCompare={handleRunManualCompare}
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
                        <IconFileMusic size={18} className={styles.signalCardInactiveIcon} />
                        <div className={styles.signalCardInactiveMeta}>
                          <span className={styles.signalCardInactiveName} title={file.name}>{file.name}</span>
                          <span className={styles.signalCardInactiveDetail}>
                            {file.durationSeconds.toFixed(2)}s · {(file.sampleRate / 1000).toFixed(1)} kHz · {file.channels}ch
                          </span>
                        </div>
                        <span className={styles.signalCardInactiveHint}>click to load</span>
                      </div>
                    );
                  }

                  return (
                    <div key={file.id} className={`${styles.signalCard} ${styles.signalCardSelected}`}>
                      <div className={styles.signalCardHeader}>
                        <span className={styles.signalCardLabel}>{file.name}</span>
                      </div>
                      <div className={styles.signalCardBody}>
                        <WaveSurferDisplay
                          fileId={file.id}
                          audioUrl={fileAudioUrl}
                          onReady={handleWaveSurferReady}
                          onTimeUpdate={handleWaveSurferTimeUpdate}
                          onFinish={handleWaveSurferFinish}
                          onUserSelectionChange={handleWaveSurferUserSelectionChange}
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
                              onClick={handleCloseComparisonPanel}
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
                      {toolPanels.map((panel) => (
                        panel.type === 'spectrogram' ? (
                          <SpectrogramPanel
                            key={panel.id}
                            panelId={panel.id}
                            availableFiles={files}
                            selectedFileId={panel.fileId}
                            currentTimeSeconds={currentTime}
                            onSeek={handleSeek}
                            onFileSelect={handleToolPanelFileSelect}
                            onClose={handleToolPanelClose}
                          />
                        ) : (
                          <SpectrumPanel
                            key={panel.id}
                            panelId={panel.id}
                            availableFiles={files}
                            selectedFileId={panel.fileId}
                            onFileSelect={handleToolPanelFileSelect}
                            onClose={handleToolPanelClose}
                          />
                        )
                      ))}
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
        </>
      )}
    </div>
  );
};

interface FileListPanelProps {
  files: AudioFile[];
  selectedSignalId: string | null;
  onSelectFile: (fileId: string) => void;
  onRemoveFile: (fileId: string) => void;
  onAddFileClick: () => void;
  onAddSpectrogram: () => void;
  onAddSpectrum: () => void;
  onRunCompare: () => void;
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
  hasComparisonPanel: boolean;
  isCompareLoading: boolean;
  width: number;
}

function FileListPanel({
  files,
  selectedSignalId,
  onSelectFile,
  onRemoveFile,
  onAddFileClick,
  onAddSpectrogram,
  onAddSpectrum,
  onRunCompare,
  hasSpectrogramPanel,
  hasSpectrumPanel,
  hasComparisonPanel,
  isCompareLoading,
  width,
}: FileListPanelProps): JSX.Element {
  const canCompare = files.length >= 2;
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
        <Group gap="xs">
          <Tooltip label={hasSpectrogramPanel ? 'Spectrogram panel already open' : 'Add spectrogram'} withArrow position="right">
            <span>
              <ActionIcon
                variant="light"
                color="teal"
                size="lg"
                onClick={onAddSpectrogram}
                disabled={hasSpectrogramPanel}
                aria-label="Add spectrogram panel"
              >
                <IconWaveSine size={18} />
              </ActionIcon>
            </span>
          </Tooltip>
          <Tooltip label={hasSpectrumPanel ? 'Spectrum panel already open' : 'Add spectrum'} withArrow position="right">
            <span>
              <ActionIcon
                variant="light"
                color="teal"
                size="lg"
                onClick={onAddSpectrum}
                disabled={hasSpectrumPanel}
                aria-label="Add spectrum panel"
              >
                <IconChartLine size={18} />
              </ActionIcon>
            </span>
          </Tooltip>
          <Tooltip
            label={!canCompare ? 'Load at least 2 files to compare' : hasComparisonPanel ? 'Comparison already open' : 'Compare all loaded files'}
            withArrow
            position="right"
          >
            <span>
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={onRunCompare}
                disabled={!canCompare || hasComparisonPanel || isCompareLoading}
                aria-label="Run A/B comparison"
              >
                {isCompareLoading ? <IconLoader2 size={18} className={styles.spinIcon} /> : <IconGitCompare size={18} />}
              </ActionIcon>
            </span>
          </Tooltip>
        </Group>
      </div>
    </div>
  );
};
