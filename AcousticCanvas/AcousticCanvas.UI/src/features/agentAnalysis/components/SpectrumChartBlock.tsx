import type { JSX } from 'react';
import { Title, Text, Paper } from '@mantine/core';
import { SpectrumCanvas } from '../../analysis/components/SpectrumCanvas';

interface ISpectrumChartBlockProps {
  fileName: string;
  frequenciesHz: number[];
  magnitudesDb: number[];
  peakFrequencyHz?: number;
  metadata?: {
    fftSize?: number;
    windowType?: string;
    scaling?: string;
  };
}

export function SpectrumChartBlock({
  fileName,
  frequenciesHz,
  magnitudesDb,
  peakFrequencyHz,
  metadata,
}: ISpectrumChartBlockProps): JSX.Element {
  if (!frequenciesHz || !magnitudesDb || frequenciesHz.length === 0 || magnitudesDb.length === 0) {
    return (
      <Paper p="sm" withBorder>
        <Title order={6}>Spectrum — {fileName}</Title>
        <Text size="sm" c="dimmed" mt="xs">No spectrum data available</Text>
      </Paper>
    );
  }

  const points = frequenciesHz.map((freq, index) => [freq, magnitudesDb[index] ?? -120]);

  const subtitleParts: string[] = [];
  if (metadata?.fftSize) {
    subtitleParts.push(`FFT: ${metadata.fftSize.toLocaleString()}`);
  }
  if (metadata?.windowType) {
    subtitleParts.push(`Window: ${metadata.windowType}`);
  }
  if (peakFrequencyHz) {
    subtitleParts.push(`Peak: ${peakFrequencyHz.toFixed(1)} Hz`);
  }

  return (
    <Paper p="md" withBorder radius="md" style={{ minWidth: 300 }}>
      <Title order={6} mb={4}>Spectrum — {fileName}</Title>
      {subtitleParts.length > 0 && (
        <Text size="xs" c="dimmed" mb="md">
          {subtitleParts.join(' • ')}
        </Text>
      )}
      <div style={{ height: 180, width: '100%' }}>
        <SpectrumCanvas
          channels={[{
            channelId: '1',
            channelName: 'Channel 1',
            points,
            yUnit: 'dB',
            yAxisLabel: 'Level [dB]',
            originalIndex: 0,
          }]}
        />
      </div>
    </Paper>
  );
}
