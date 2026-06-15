import type { JSX } from 'react';
import { useState } from 'react';
import { Text, Paper, Stack, Group, Badge, ActionIcon, Modal } from '@mantine/core';
import { IconChartLine, IconMaximize } from '@tabler/icons-react';
import type { SpectrumOverlayBlock } from '../services/agentAskService';
import { useAnalysisResult } from '../../analysis/hooks/useAnalysisResult';
import { SpectrumCanvas } from '../../analysis/components/SpectrumCanvas';

interface ISpectrumOverlayBlockProps {
  block: SpectrumOverlayBlock;
}

function OverlayLoader({
  block,
  height,
}: ISpectrumOverlayBlockProps & { height: number }): JSX.Element {
  // Fixed-length hook unroll — Rules of Hooks requires unconditional calls.
  const r0 = useAnalysisResult(block.signals[0]?.resultId ?? '');
  const r1 = useAnalysisResult(block.signals[1]?.resultId ?? '');
  const r2 = useAnalysisResult(block.signals[2]?.resultId ?? '');
  const r3 = useAnalysisResult(block.signals[3]?.resultId ?? '');

  const rawResults = [r0, r1, r2, r3].slice(0, block.signals.length);

  const isLoading = rawResults.some((r) => r.isLoading);
  const hasError = rawResults.some((r) => r.error);

  if (isLoading) {
    return <Text size="xs" c="dimmed">Loading overlay...</Text>;
  }

  if (hasError) {
    return <Text size="xs" c="red">Failed to load one or more spectra.</Text>;
  }

  const channels: {
    channelId: string;
    channelName: string;
    points: number[][];
    yUnit: string;
    yAxisLabel?: string | null;
    originalIndex: number;
  }[] = [];

  let globalIndex = 0;

  for (let signalIdx = 0; signalIdx < block.signals.length; signalIdx++) {
    const signal = block.signals[signalIdx];
    const result = rawResults[signalIdx].result;

    if (!result || result.type !== 'spectrum') {
      continue;
    }

    for (const ch of result.data.channels) {
      channels.push({
        channelId: `${signal.fileId}_${ch.channelId}`,
        channelName: `${signal.fileName} — ${ch.channelName}`,
        points: ch.points,
        yUnit: ch.yUnit,
        yAxisLabel: ch.yAxisLabel,
        originalIndex: globalIndex++,
      });
    }
  }

  if (channels.length === 0) {
    return <Text size="xs" c="dimmed">No spectrum data available for overlay.</Text>;
  }

  const sharedHints = block.sharedPlotHints;

  return (
    <div style={{ height, width: '100%' }}>
      <SpectrumCanvas
        channels={channels}
        minFrequencyHz={sharedHints?.frequencyRangeMinHz}
        maxFrequencyHz={sharedHints?.frequencyRangeMaxHz}
      />
    </div>
  );
}

export function SpectrumOverlayBlockView({ block }: ISpectrumOverlayBlockProps): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Paper p="sm" withBorder radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconChartLine size={14} />
              <Text size="sm" fw={600}>{block.title}</Text>
            </Group>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setModalOpen(true)}
              title="Expand overlay"
            >
              <IconMaximize size={14} />
            </ActionIcon>
          </Group>
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge key={index} size="xs" variant="light" color="blue">
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <OverlayLoader block={block} height={200} />
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
              <Badge key={index} size="sm" variant="light" color="blue">
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <OverlayLoader block={block} height={420} />
        </Stack>
      </Modal>
    </>
  );
}
