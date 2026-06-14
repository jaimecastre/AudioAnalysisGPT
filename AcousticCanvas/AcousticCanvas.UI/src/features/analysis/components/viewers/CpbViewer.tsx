import type { JSX } from 'react';
import { useState, useMemo } from 'react';
import { Stack, Text, Group, Badge, Select, Table } from '@mantine/core';
import type { CpbAnalysis } from '../../types/cpbTypes';
import { CpbCanvas } from '../CpbCanvas';

interface ICpbViewerProps {
  result: CpbAnalysis;
}

export function CpbViewer({ result }: ICpbViewerProps): JSX.Element {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    result.channels[0]?.channelId ?? null
  );

  const selectedChannel = useMemo(() => {
    return result.channels.find((ch) => ch.channelId === selectedChannelId) ?? result.channels[0];
  }, [result.channels, selectedChannelId]);

  const hasMultiChannel = result.channels.length > 1;

  return (
    <Stack gap="md">
      {/* Parameters */}
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" size="sm">
          {result.parameters.bandMode === 'octave' ? 'Octave' : '1/3 Octave'}
        </Badge>
        <Badge variant="light" size="sm">
          {result.parameters.weighting.toUpperCase()} weighting
        </Badge>
        <Badge variant="light" size="sm">
          {result.parameters.startTimeSeconds.toFixed(2)} – {result.parameters.endTimeSeconds.toFixed(2)} s
        </Badge>
        <Badge variant="light" size="sm">
          FFT: {result.parameters.fftSize.toLocaleString()}
        </Badge>
      </Group>

      {/* Channel selector */}
      {hasMultiChannel && (
        <Select
          size="xs"
          label="Channel"
          value={selectedChannelId ?? result.channels[0]?.channelId}
          onChange={(value) => setSelectedChannelId(value ?? null)}
          data={result.channels.map((ch) => ({
            value: ch.channelId,
            label: ch.channelName,
          }))}
          style={{ maxWidth: 200 }}
        />
      )}

      {/* CPB Chart */}
      {selectedChannel && (
        <div style={{ height: 250, width: '100%' }}>
          <CpbCanvas
            bands={selectedChannel.bands}
            dbUnit={selectedChannel.dbUnit}
          />
        </div>
      )}

      {/* Band table */}
      {selectedChannel && (
        <div>
          <Text size="sm" fw={500} mb="xs">
            Band Levels ({selectedChannel.bands.length} bands)
          </Text>
          <Table variant="vertical" layout="fixed">
            <Table.Tbody>
              {selectedChannel.bands.slice(0, 10).map((band) => (
                <Table.Tr key={band.label}>
                  <Table.Td w="40%">{band.label}</Table.Td>
                  <Table.Td w="30%" c="dimmed">
                    {band.centerFrequencyHz.toFixed(0)} Hz
                  </Table.Td>
                  <Table.Td w="30%" ta="right">
                    {band.levelDb?.toFixed(1) ?? '-'} {selectedChannel.dbUnit ?? 'dB'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {selectedChannel.bands.length > 10 && (
            <Text size="xs" c="dimmed" ta="center" mt="xs">
              + {selectedChannel.bands.length - 10} more bands
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
}
