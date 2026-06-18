import type { JSX } from 'react';
import { useState } from 'react';
import { Text, Paper, Stack, Group, Badge, ActionIcon, Modal, SimpleGrid } from '@mantine/core';
import { IconChartBar, IconMaximize } from '@tabler/icons-react';
import type { SoundQualityComparisonBlock, SoundQualitySignal } from '../services/agentAskService';
import { SoundQualityMetricBars } from '../../analysis/components/viewers/SoundQualityViewer';
import type { SoundQualityAnalysis } from '../../analysis/types/soundQualityTypes';

interface ISoundQualityComparisonBlockProps {
  block: SoundQualityComparisonBlock;
}

function buildMinimalAnalysis(signal: SoundQualitySignal): SoundQualityAnalysis {
  return {
    parameters: {
      method: 'mosqito_stationary_zwicker',
      library: 'MoSQITo',
      startTimeSeconds: 0,
      endTimeSeconds: 0,
      sampleRate: 0,
      limitations: [],
    },
    region: { startSeconds: 0, endSeconds: 0, durationSeconds: 0 },
    loudness: { name: 'Loudness', value: signal.loudnessSone, unit: 'sone', method: '' },
    sharpness: { name: 'Sharpness', value: signal.sharpnessAcum, unit: 'acum', method: '' },
    roughness: { name: 'Roughness', value: signal.roughnessAsper, unit: 'asper', method: '' },
  };
}

function getColCount(signalCount: number): number {
  if (signalCount <= 2) return 2;
  if (signalCount === 3) return 3;
  if (signalCount === 4) return 2; // 2×2 grid
  return 3; // 5–6 files: 2 rows of 3
}

function ComparisonGrid({ signals }: { signals: SoundQualitySignal[] }): JSX.Element {
  const colCount = getColCount(signals.length);

  return (
    <SimpleGrid cols={colCount} spacing="sm">
      {signals.map((signal, index) => (
        <Stack key={index} gap="xs">
          <Text size="xs" fw={600} truncate>{signal.fileName}</Text>
          <SoundQualityMetricBars result={buildMinimalAnalysis(signal)} />
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export const SoundQualityComparisonBlockView = ({ block }: ISoundQualityComparisonBlockProps): JSX.Element => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Paper p="sm" withBorder radius="md" mt="xs">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconChartBar size={14} />
              <Text size="sm" fw={600}>{block.title}</Text>
            </Group>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setModalOpen(true)}
              title="Expand comparison"
            >
              <IconMaximize size={14} />
            </ActionIcon>
          </Group>
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge key={index} size="xs" variant="light" color="orange">
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <ComparisonGrid signals={block.signals} />
        </Stack>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={block.title}
        size="xl"
      >
        <Stack gap="sm">
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge key={index} size="sm" variant="light" color="orange">
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <ComparisonGrid signals={block.signals} />
        </Stack>
      </Modal>
    </>
  );
};
