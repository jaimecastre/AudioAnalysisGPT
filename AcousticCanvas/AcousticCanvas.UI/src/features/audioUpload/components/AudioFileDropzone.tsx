import type { JSX } from 'react';
import { Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconFileMusic, IconX } from '@tabler/icons-react';
import styles from './AudioFileDropzone.module.scss';

export type OnAudioFilesUploaded = (files: File[]) => void;

interface IAudioFileDropzoneProps {
  onFileSelected: OnAudioFilesUploaded;
  isUploading?: boolean;
}

const ACCEPTED_AUDIO_TYPES: Record<string, string[]> = {
  'audio/wav': ['.wav'],
  'audio/mpeg': ['.mp3'],
  'audio/flac': ['.flac'],
  'audio/aiff': ['.aiff', '.aif'],
  'audio/ogg': ['.ogg'],
};

export const AudioFileDropzone = ({
  onFileSelected,
  isUploading = false,
}: IAudioFileDropzoneProps): JSX.Element => {
  const handleDrop = (dropped: File[]): void => {
    if (dropped.length > 0) {
      onFileSelected(dropped);
    }
  };

  return (
    <Dropzone
      onDrop={handleDrop}
      onReject={(files) => console.log('rejected files', files)}
      maxSize={100 * 1024 ** 2}
      accept={ACCEPTED_AUDIO_TYPES}
      disabled={isUploading}
      className={styles.dropzone}
    >
      <Stack align="center" justify="center" gap="md" mih={220} style={{ pointerEvents: 'none' }}>
        <Dropzone.Accept>
          <IconUpload size={48} color="var(--mantine-color-teal-6)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={48} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconFileMusic size={48} color="var(--mantine-color-dimmed)" />
        </Dropzone.Idle>

        <Stack align="center" gap={4}>
          <Text size="lg" fw={500}>
            {isUploading ? 'Uploading...' : 'Drop audio files here'}
          </Text>
          <Text size="sm" c="dimmed">
            {isUploading ? 'Please wait' : 'or click to select — multiple files supported'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            WAV · MP3 · FLAC · AIFF · OGG &nbsp;·&nbsp; 100 MB max per file
          </Text>
        </Stack>
      </Stack>
    </Dropzone>
  );
};
