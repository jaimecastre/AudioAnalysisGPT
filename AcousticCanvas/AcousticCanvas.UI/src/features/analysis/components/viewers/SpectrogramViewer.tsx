import type { JSX } from 'react';
import { Alert, Badge, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { SpectrogramAnalysis } from '../../types/spectrogramTypes';
import { SpectrogramPlot } from '../SpectrogramPlot';

interface ISpectrogramViewerProps {
  result: SpectrogramAnalysis;
}

const VIEWER_PLOT_HEIGHT = 360;

export const SpectrogramViewer = ({ result }: ISpectrogramViewerProps): JSX.Element => {
  const firstChannel = result.channels[0] ?? null;

  return (
    <Stack gap="md">
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" size="sm">FFT: {result.parameters.fftSize.toLocaleString()}</Badge>
        <Badge variant="light" size="sm">Scale: {result.parameters.scale}</Badge>
        <Badge variant="light" size="sm">
          {result.region.startSeconds.toFixed(2)} - {result.region.endSeconds.toFixed(2)} s
        </Badge>
        {firstChannel && (
          <Badge variant="light" size="sm">
            Nyquist: {formatFrequency(firstChannel.nyquistHz)}
          </Badge>
        )}
      </Group>

      {firstChannel?.calibrationState === 'digital_full_scale' && (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" p="xs">
          <Text size="xs">
            No calibration data. Showing relative amplitude [dBFS].
          </Text>
        </Alert>
      )}

      {firstChannel ? (
        <SpectrogramPlot result={result} height={VIEWER_PLOT_HEIGHT} />
      ) : (
        <Text size="sm" c="dimmed">No spectrogram channel data available.</Text>
      )}

      {firstChannel && (
        <Text size="xs" c="dimmed">
          {firstChannel.frameCount.toLocaleString()} frames x {firstChannel.binCount.toLocaleString()} bins.
          Color scale: {firstChannel.colorbandLabel ?? 'relative amplitude'}.
        </Text>
      )}
    </Stack>
  );
};

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(1)} kHz`;
  }
  return `${frequencyHz.toFixed(0)} Hz`;
}
