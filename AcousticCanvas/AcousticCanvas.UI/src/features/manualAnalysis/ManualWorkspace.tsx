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
import { Text, Card, Group, ActionIcon, Tooltip, SegmentedControl, Box, Checkbox } from '@mantine/core';
import { IconRepeat, IconX, IconFileMusic, IconInfoCircle } from '@tabler/icons-react';
import { RightSidebar } from './RightSidebar';
import { useRunAnalysis } from '../analysis/useRunAnalysis';
import {
  analysisResultSelector,
  analysisStatusSelector,
  analysisErrorSelector,
  analysisClear,
} from '../analysis/analysisSlice';
import { useRunSpectrum } from '../analysis/useRunSpectrum';
import {
  spectrumResultSelector,
  spectrumStatusSelector,
  spectrumErrorSelector,
  spectrumUserParametersSelector,
  spectrumSetParameters,
} from '../analysis/spectrumSlice';
import { SpectrumCanvas } from '../analysis/SpectrumCanvas';
import styles from './ManualWorkspace.module.scss';

type ViewMode = 'time' | 'frequency' | 'split';

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
  const spectrumResult = useAppSelector(spectrumResultSelector);
  const spectrumStatus = useAppSelector(spectrumStatusSelector);
  const spectrumError = useAppSelector(spectrumErrorSelector);
  const spectrumUserParameters = useAppSelector(spectrumUserParametersSelector);
  const { runAnalysis } = useRunAnalysis();
  const { runSpectrum } = useRunSpectrum();

  const waveSurferRef = useRef<WaveSurferDisplayRef | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('time');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Channel visibility state - lifted up to share between sidebar and main view
  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<string>>(new Set());

  const toggleChannel = (channelId: string) => {
    setHiddenChannelIds(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
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

  // Auto-calculate spectrum when selection changes (so it's ready when user switches tabs).
  useEffect(() => {
    if (selectedSignalId && activeSelection && activeSelection.endSeconds > activeSelection.startSeconds) {
      runSpectrum({
        fileId: selectedSignalId,
        startSeconds: activeSelection.startSeconds,
        endSeconds: activeSelection.endSeconds,
        parameters: spectrumUserParameters,
      });
    }
  }, [selectedSignalId, activeSelection?.startSeconds, activeSelection?.endSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetSpectrumFftSize = (fftSize: number): void => {
    dispatch(spectrumSetParameters({ fftSize }));
  };

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
          />
          <div className={styles.contentRow}>
          <div className={styles.mainArea}>
            <div className={styles.viewModeBar}>
              <SegmentedControl
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                data={[
                  { label: 'Waveform', value: 'time' },
                  { label: 'Spectrum', value: 'frequency' },
                  { label: 'Both', value: 'split' },
                ]}
                size="xs"
                classNames={{
                  root: styles.viewModeRoot,
                  indicator: styles.viewModeIndicator,
                  label: styles.viewModeLabel,
                }}
              />
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
                  {/* Channel visibility toggles - only show in spectrum views with multiple channels */}
                  {(viewMode === 'frequency' || viewMode === 'split') && spectrumResult && spectrumResult.channels.length > 1 && (
                    <Group gap="sm">
                      {spectrumResult.channels.map(ch => (
                        <Checkbox
                          key={ch.channelId}
                          size="xs"
                          label={ch.channelName}
                          checked={!hiddenChannelIds.has(ch.channelId)}
                          onChange={() => toggleChannel(ch.channelId)}
                        />
                      ))}
                    </Group>
                  )}
                </div>
                <div className={
                  viewMode === 'split'
                    ? styles.signalCardBodySplit
                    : viewMode === 'time'
                      ? styles.signalCardBodyTime
                      : styles.signalCardBody
                }>
                  {(viewMode === 'time' || viewMode === 'split') && (
                    <WaveSurferDisplay
                      fileId={uploadedFile.id}
                      audioUrl={audioUrl}
                      onReady={handleWaveSurferReady}
                      onTimeUpdate={handleWaveSurferTimeUpdate}
                      onFinish={handleWaveSurferFinish}
                      displayRef={waveSurferRef}
                    />
                  )}
                  {(viewMode === 'frequency' || viewMode === 'split') && (
                    spectrumResult && spectrumResult.channels.length > 0 ? (
                      <Box className={viewMode === 'split' ? styles.spectrumContainerSplit : styles.spectrumContainer}>
                        <SpectrumCanvas
                          channels={spectrumResult.channels
                            .filter(ch => !hiddenChannelIds.has(ch.channelId))
                            .map(ch => ({
                              channelId: ch.channelId,
                              channelName: ch.channelName,
                              frequenciesHz: ch.frequenciesHz,
                              magnitudes: ch.magnitudes,
                              magnitudesDb: ch.magnitudesDb,
                              yMode: ch.dbUnit ? 'db' : 'linear',
                              yUnit: ch.dbUnit ?? ch.unit ?? '',
                            }))}
                        />
                      </Box>
                    ) : (
                      <Box className={viewMode === 'split' ? styles.spectrumContainerSplit : styles.spectrumContainer}>
                        <div className={styles.emptyState}>
                          <Text size="sm" c="dimmed">Select a region to see spectrum</Text>
                        </div>
                      </Box>
                    )
                  )}
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
            spectrumResult={spectrumResult}
            spectrumStatus={spectrumStatus}
            spectrumError={spectrumError}
            spectrumUserParameters={spectrumUserParameters}
            activeSelection={activeSelection}
            onSetSpectrumFftSize={handleSetSpectrumFftSize}
          />
        </>
      )}
    </div>
  );
};

interface FileListPanelProps {
  uploadedFile: { id: string; name: string } | null;
  onClearFile: () => void;
}

const FileListPanel = ({ uploadedFile, onClearFile }: FileListPanelProps): JSX.Element => {
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
          <Text
            size="xs"
            c="dimmed"
            mt="sm"
            style={{ cursor: 'pointer' }}
            onClick={onClearFile}
          >
            Click to remove
          </Text>
        </Card>
      )}
    </div>
  );
};
