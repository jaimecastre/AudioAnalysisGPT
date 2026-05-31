import type { JSX } from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioFileDropzone } from '../audioUpload/AudioFileDropzone';
import { useAudioUpload } from '../audioUpload/useAudioUpload';
import { TransportUI } from '../playback/TransportUI';
import { WaveSurferDisplay } from '../waveform/WaveSurferDisplay';
import type { WaveSurferDisplayRef } from '../waveform/WaveSurferDisplay';
import { apiClient } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { useAppSelector, useAppDispatch } from '../../store/reduxHooks';
import {
  projectFilesSelector,
  removeAudioFile,
  selectedSignalIdSelector,
} from '../project/projectSlice';
import {
  setLoopEnabled,
  loopEnabledSelector,
  activeSelectionSelector,
} from '../waveform/waveformSelectionSlice';
import { Text, Card, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconRepeat, IconX, IconFileMusic, IconInfoCircle, IconWaveSine, IconChartLine, IconTrash } from '@tabler/icons-react';
import { RightSidebar } from './RightSidebar';
import { useRunAnalysis } from '../analysis/useRunAnalysis';
import {
  analysisResultSelector,
  analysisStatusSelector,
  analysisErrorSelector,
  analysisClear,
} from '../analysis/analysisSlice';
import { SpectrogramPanel } from '../analysis/SpectrogramPanel';
import { SpectrumPanel } from '../analysis/SpectrumPanel';
import styles from './ManualWorkspace.module.scss';

interface ManualWorkspaceProps {
  showDropzone?: boolean;
}

export const ManualWorkspace = ({ showDropzone = false }: ManualWorkspaceProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const files = useAppSelector(projectFilesSelector);
  const uploadedFile = files.length > 0 ? files[0] : null;
  const { isUploading, uploadFile } = useAudioUpload();
  const loopEnabled = useAppSelector(loopEnabledSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const analysisResult = useAppSelector(analysisResultSelector);
  const analysisStatus = useAppSelector(analysisStatusSelector);
  const analysisError = useAppSelector(analysisErrorSelector);
  const selectedSignalId = useAppSelector(selectedSignalIdSelector);
  const { runAnalysis } = useRunAnalysis();

  const waveSurferRef = useRef<WaveSurferDisplayRef | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Tool panels spawned from the toolbox
  const [toolPanels, setToolPanels] = useState<Array<{ id: string; type: 'spectrogram' | 'spectrum'; fileId: string | null }>>([]);
  const hasSpectrogramPanel = toolPanels.some((panel) => panel.type === 'spectrogram');
  const hasSpectrumPanel = toolPanels.some((panel) => panel.type === 'spectrum');

  const handleAddSpectrogramPanel = (): void => {
    if (hasSpectrogramPanel) return;
    const newPanelId = `spectrogram-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrogram', fileId: selectedSignalId ?? null }]);
  };

  const handleAddSpectrumPanel = (): void => {
    if (hasSpectrumPanel) return;
    const newPanelId = `spectrum-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrum', fileId: selectedSignalId ?? null }]);
  };

  const handleToolPanelFileSelect = (panelId: string, fileId: string | null): void => {
    setToolPanels((prev) => prev.map((p) => p.id === panelId ? { ...p, fileId } : p));
  };

  const handleToolPanelClose = (panelId: string): void => {
    setToolPanels((prev) => prev.filter((p) => p.id !== panelId));
  };


  const audioUrl = uploadedFile
    ? apiClient.buildUrl(API_ENDPOINTS.AUDIO.GET_FILE(uploadedFile.id))
    : '';

  const handleWaveSurferReady = useCallback((audioDuration: number): void => {
    setDuration(audioDuration);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleWaveSurferTimeUpdate = useCallback((time: number): void => {
    setCurrentTime(time);
  }, []);

  const handleWaveSurferFinish = useCallback((): void => {
    setIsPlaying(false);
  }, []);

  const handlePlay = (): void => {
    waveSurferRef.current?.play();
    setIsPlaying(true);
  };

  const handlePause = (): void => {
    waveSurferRef.current?.pause();
    setIsPlaying(false);
  };

  const handleSeek = (timeSeconds: number): void => {
    waveSurferRef.current?.seek(timeSeconds);
    setCurrentTime(timeSeconds);
  };

  // Auto-run analysis whenever the selected signal changes.
  useEffect(() => {
    if (selectedSignalId) {
      runAnalysis(selectedSignalId);
    }
  }, [selectedSignalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearFile = (): void => {
    waveSurferRef.current?.pause();
    waveSurferRef.current?.clearSelection();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    dispatch(analysisClear());
    if (uploadedFile) {
      dispatch(removeAudioFile(uploadedFile.id));
    }
  };

  const handleToggleLoop = (): void => {
    dispatch(setLoopEnabled(!loopEnabled));
  };

  const handleClearSelection = (): void => {
    waveSurferRef.current?.clearSelection();
  };

  // Home view: always show welcome placeholder
  // Import view: show dropzone if no file, show file content if uploaded
  const isHomeView = !showDropzone;
  const shouldShowFileContent = uploadedFile && showDropzone;

  return (
    <div className={styles.workspaceWithFileList}>
      {isHomeView && (
        <div className={styles.workspace}>
          <div className={styles.emptyState}>
            <p>Welcome to SoundLens</p>
          </div>
        </div>
      )}

      {showDropzone && !uploadedFile && (
        <div className={styles.workspace}>
          <AudioFileDropzone onFileSelected={uploadFile} isUploading={isUploading} />
        </div>
      )}

      {shouldShowFileContent && (
        <>
          <FileListPanel
            uploadedFile={uploadedFile}
            onClearFile={handleClearFile}
            onAddSpectrogram={handleAddSpectrogramPanel}
            onAddSpectrum={handleAddSpectrumPanel}
            hasSpectrogramPanel={hasSpectrogramPanel}
            hasSpectrumPanel={hasSpectrumPanel}
          />
          <div className={styles.contentRow}>
          <div className={styles.mainArea}>
            <div className={styles.viewModeBar}>
              <div />
              <Tooltip label="Open inspector" withArrow position="bottom">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => setIsInspectorOpen(true)}
                  aria-label="Open inspector"
                >
                  <IconInfoCircle size={18} />
                </ActionIcon>
              </Tooltip>
            </div>
            <div className={styles.signalViewport}>
              <div
                className={`${styles.signalCard} ${selectedSignalId === uploadedFile.id ? styles.signalCardSelected : ''}`}
              >
                <div className={styles.signalCardHeader}>
                  <span className={styles.signalCardLabel}>{uploadedFile.name}</span>
                </div>
                <div className={styles.signalCardBody}>
                  <WaveSurferDisplay
                    fileId={uploadedFile.id}
                    audioUrl={audioUrl}
                    onReady={handleWaveSurferReady}
                    onTimeUpdate={handleWaveSurferTimeUpdate}
                    onFinish={handleWaveSurferFinish}
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
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            analysisResult={analysisResult}
            analysisStatus={analysisStatus}
            analysisError={analysisError}
            selectedFileName={files.find((f) => f.id === selectedSignalId)?.name ?? null}
          />
        </>
      )}
    </div>
  );
};

interface FileListPanelProps {
  uploadedFile: { id: string; name: string } | null;
  onClearFile: () => void;
  onAddSpectrogram: () => void;
  onAddSpectrum: () => void;
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
}

const FileListPanel = ({
  uploadedFile,
  onClearFile,
  onAddSpectrogram,
  onAddSpectrum,
  hasSpectrogramPanel,
  hasSpectrumPanel,
}: FileListPanelProps): JSX.Element => {
  return (
    <div className={styles.fileListPanel}>
      <Text fw={600} size="sm" mb="md" c="dimmed">FILES</Text>
      {uploadedFile && (
        <Card withBorder shadow="sm" padding="sm">
          <Group gap="xs" mb="xs">
            <IconFileMusic size={20} />
            <Text fw={500} size="sm" truncate style={{ flex: 1 }}>
              {uploadedFile.name}
            </Text>
          </Group>
          <Tooltip label="Remove audio file" withArrow position="right">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              mt="xs"
              onClick={onClearFile}
              aria-label="Remove audio file"
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </Card>
      )}

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
