import type { JSX } from 'react';
import { ActionIcon, Slider, Group, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import styles from './TransportUI.module.scss';

interface TransportUIProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timeSeconds: number) => void;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00.00';
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
};

export const TransportUI = ({
  isPlaying,
  currentTime,
  duration,
  isLoading,
  onPlay,
  onPause,
  onSeek,
}: TransportUIProps): JSX.Element => {
  const handlePlayPause = (): void => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleSeek = (value: number): void => {
    onSeek(value);
  };

  return (
    <div className={styles.transportContainer}>
      <Group gap="md" align="center">
        <ActionIcon
          variant="filled"
          color="blue"
          size="lg"
          disabled={isLoading || duration === 0}
          onClick={handlePlayPause}
        >
          {isPlaying ? <IconPlayerPause size={24} /> : <IconPlayerPlay size={24} />}
        </ActionIcon>

        <div className={styles.timelineContainer}>
          <Slider
            value={currentTime}
            min={0}
            max={duration || 1}
            step={0.01}
            disabled={duration === 0}
            onChange={handleSeek}
            onChangeEnd={handleSeek}
            className={styles.timelineSlider}
            showLabelOnHover={false}
          />
        </div>

        <div className={styles.timeDisplay}>
          <Text size="sm" fw={500}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </div>
      </Group>
    </div>
  );
};
