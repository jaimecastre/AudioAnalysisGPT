import type { JSX } from 'react';
import { useMemo } from 'react';
import { Stack, Text, Alert, Group, Badge } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type { SpectrumPointsResponse } from '../../types/spectrumTypes';
import { SpectrumCanvas } from '../SpectrumCanvas';

interface ISpectrumViewerProps {
  result: SpectrumPointsResponse;
}

export function SpectrumViewer({ result }: ISpectrumViewerProps): JSX.Element {
  const channels = useMemo(() => {
    return result.channels.map((ch, index) => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      points: ch.points,
      yUnit: ch.yUnit,
      yAxisLabel: ch.yAxisLabel,
      originalIndex: index,
    }));
  }, [result.channels]);

  const tonalPeaks = useMemo(() => {
    return result.channels
      .flatMap((channel) =>
        channel.tonalPeaks.map((peak) => ({ ...peak, channelName: channel.channelName }))
      )
      .sort((a, b) => b.prominenceDb - a.prominenceDb)
      .slice(0, 5);
  }, [result.channels]);

  const firstChannel = result.channels[0];
  const binSpacingHz =
    firstChannel && firstChannel.points.length > 1
      ? (firstChannel.points[1][0] - firstChannel.points[0][0]).toFixed(2)
      : null;

  return (
    <Stack gap="md">
      {/* Parameter summary */}
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" size="sm">
          FFT: {result.parameters.fftSize.toLocaleString()}
        </Badge>
        <Badge variant="light" size="sm">
          Window: {result.parameters.windowType}
        </Badge>
        <Badge variant="light" size="sm">
          {result.parameters.startTimeSeconds.toFixed(2)} – {result.parameters.endTimeSeconds.toFixed(2)} s
        </Badge>
        {binSpacingHz && (
          <Badge variant="light" size="sm">
            {binSpacingHz} Hz/bin
          </Badge>
        )}
      </Group>

      {/* Calibration warning */}
      {firstChannel?.calibrationState === 'digital_full_scale' && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          variant="light"
          p="xs"
        >
          <Text size="xs">
            No calibration data. Showing relative level [dBFS].
          </Text>
        </Alert>
      )}

      {/* Spectrum chart */}
      {channels.length > 0 && (
        <div style={{ height: 300, width: '100%' }}>
          <SpectrumCanvas channels={channels} />
        </div>
      )}

      {/* Tonal peaks table */}
      {tonalPeaks.length > 0 && (
        <div>
          <Text size="sm" fw={500} mb="xs">
            <IconInfoCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Tonal Peaks
          </Text>
          <Stack gap="xs">
            {tonalPeaks.map((peak, index) => (
              <Group key={`${peak.channelName}-${peak.frequencyHz}`} justify="space-between">
                <Group gap="xs">
                  <Text size="xs" c="dimmed">#{index + 1}</Text>
                  <Text size="sm" fw={500}>
                    {formatFrequency(peak.frequencyHz)}
                  </Text>
                  <Badge size="xs" variant="light">
                    {peak.channelName}
                  </Badge>
                </Group>
                <Group gap="md">
                  <Text size="xs">{peak.magnitudeDb.toFixed(1)} dB</Text>
                  <Text size="xs" c="dimmed">
                    {peak.prominenceDb.toFixed(1)} dB prominence
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  }
  return `${frequencyHz.toFixed(1)} Hz`;
}
