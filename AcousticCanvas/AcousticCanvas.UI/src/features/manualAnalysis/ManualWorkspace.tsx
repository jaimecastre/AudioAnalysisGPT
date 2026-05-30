import type { JSX } from 'react';
import { useEffect } from 'react';
import { AudioFileDropzone } from '../audioUpload/AudioFileDropzone';
import { useAudioUpload } from '../audioUpload/useAudioUpload';
import { useAudioPlayer } from '../playback/useAudioPlayer';
import { TransportUI } from '../playback/TransportUI';
import { WaveformChart } from '../playback/WaveformChart';
import { apiClient } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { Text, Stack, Badge, Card, Group } from '@mantine/core';
import { IconFileMusic } from '@tabler/icons-react';
import styles from './ManualWorkspace.module.scss';

interface ManualWorkspaceProps {
  showDropzone?: boolean;
}

export const ManualWorkspace = ({ showDropzone = false }: ManualWorkspaceProps): JSX.Element => {
  const { isUploading, uploadedFile, waveformBins, uploadFile, clearUploadedFile } = useAudioUpload();
  const {
    isPlaying,
    currentTime,
    duration,
    isLoading: isAudioLoading,
    play,
    pause,
    seek,
    loadFile,
    unloadFile,
  } = useAudioPlayer();

  useEffect(() => {
    if (uploadedFile) {
      const fileUrl = apiClient.buildUrl(API_ENDPOINTS.AUDIO.GET_FILE(uploadedFile.id));
      loadFile(fileUrl);
    }
  }, [uploadedFile, loadFile]);

  const handleClearFile = (): void => {
    unloadFile();
    clearUploadedFile();
  };

  const shouldShowEmptyState = !uploadedFile && !showDropzone;
  const shouldShowDropzone = !uploadedFile && showDropzone;

  return (
    <div className={styles.workspaceWithFileList}>
      {shouldShowEmptyState && (
        <div className={styles.workspace}>
          <div className={styles.emptyState}>
            <p>Select Import from the sidebar to upload an audio file</p>
          </div>
        </div>
      )}

      {shouldShowDropzone && (
        <div className={styles.workspace}>
          <AudioFileDropzone onFileSelected={uploadFile} isUploading={isUploading} />
        </div>
      )}

      {uploadedFile && (
        <div className={styles.mainArea}>
          <WaveformChart
            waveformBins={waveformBins}
            currentTime={currentTime}
            duration={duration}
          />
          <TransportUI
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLoading={isAudioLoading}
            onPlay={play}
            onPause={pause}
            onSeek={seek}
          />
          <FileListPanel
            uploadedFile={uploadedFile}
            onClearFile={handleClearFile}
          />
        </div>
      )}
    </div>
  );
};

interface FileListPanelProps {
  uploadedFile: { id: string; name: string; durationSeconds: number; sampleRate: number; channels: number; bitDepth: number } | null;
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
          <Stack gap={4}>
            <Badge size="xs" color="teal" variant="light">
              {uploadedFile.durationSeconds.toFixed(2)}s
            </Badge>
            <Badge size="xs" color="blue" variant="light">
              {uploadedFile.sampleRate} Hz
            </Badge>
            <Badge size="xs" color="gray" variant="light">
              {uploadedFile.channels} ch / {uploadedFile.bitDepth}-bit
            </Badge>
          </Stack>
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
