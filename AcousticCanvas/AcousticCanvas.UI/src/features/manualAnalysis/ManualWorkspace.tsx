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
import { IconRepeat, IconX, IconFileMusic, IconWaveSine, IconChartLine, IconTrash, IconUpload, IconRobot, IconPlus } from '@tabler/icons-react';
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

  const { isUploading, uploadFile } = useAudioUpload();
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

  const handleFileSelected = async (file: File): Promise<void> => {
    const result = await uploadFile(file);
    if (result) {
      dispatch(setActiveView('import'));
    }
  };

  const handleAddFileClick = (): void => {
    addFileInputRef.current?.click();
  };

  const handleAddFileInputChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (file) {
      await uploadFile(file);
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

  return (
    <div className={styles.workspaceWithFileList}>
      {files.length === 0 && (
        <div className={styles.workspace}>
          <AudioFileDropzone onFileSelected={handleFileSelected} isUploading={isUploading} />
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
            style={{ display: 'none' }}
            onChange={handleAddFileInputChange}
            aria-label="Add audio file"
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
                  const droppedFile = event.dataTransfer.files[0];
                  if (droppedFile) handleFileSelected(droppedFile);
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
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
  width: number;
}

const FileListPanel = ({
  files,
  selectedSignalId,
  onSelectFile,
  onRemoveFile,
  onAddFileClick,
  onAddSpectrogram,
  onAddSpectrum,
  hasSpectrogramPanel,
  hasSpectrumPanel,
  width,
}: FileListPanelProps): JSX.Element => {
  return (
    <div className={styles.fileListPanel} style={{ width }}>
      <Text fw={600} size="sm" mb="md" c="dimmed">FILES</Text>
      {files.map((file) => {
        const isActive = file.id === selectedSignalId;
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
            <div className={styles.fileTreeChildren}>
              <div className={styles.fileTreeChannelRow}>
                <span className={styles.fileTreeChannelLabel}>
                  {file.durationSeconds.toFixed(2)}s · {(file.sampleRate / 1000).toFixed(1)} kHz · {file.channels}ch
                </span>
              </div>
            </div>
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
        </Group>
      </div>
    </div>
  );
};
