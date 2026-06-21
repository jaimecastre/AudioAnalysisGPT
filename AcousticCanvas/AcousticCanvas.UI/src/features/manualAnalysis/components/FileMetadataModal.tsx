import type { JSX } from 'react';
import { Modal, Text, Stack, Group } from '@mantine/core';
import type { AudioFile } from '../../../store/projectState';

interface FileMetadataModalProps {
  file: AudioFile | null;
  opened: boolean;
  onClose: () => void;
}

export const FileMetadataModal = ({ file, opened, onClose }: FileMetadataModalProps): JSX.Element => {
  if (!file) {
    return <></>;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="File Information"
      size="400px"
      centered
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">File name</Text>
          <Text size="sm" fw={500}>{file.name}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Duration</Text>
          <Text size="sm">{formatDuration(file.durationSeconds)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Sample rate</Text>
          <Text size="sm">{file.sampleRate} Hz</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Channels</Text>
          <Text size="sm">{file.channels}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Bit depth</Text>
          <Text size="sm">{file.bitDepth} bit</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">File size</Text>
          <Text size="sm">{formatFileSize(file.fileSizeBytes)}</Text>
        </Group>
      </Stack>
    </Modal>
  );
};
