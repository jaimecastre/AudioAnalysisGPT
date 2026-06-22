import type { JSX } from 'react';
import { useState } from 'react';
import { Text, Paper, Stack, Group, Badge, ActionIcon, Modal } from '@mantine/core';
import { RadarChart } from '@mantine/charts';
import { IconChartRadar, IconMaximize } from '@tabler/icons-react';
import type { RadarChartBlock } from '../services/agentAskService';
import { buildRadarChartInput } from '../utils/radarChartUtils';

interface IRadarChartBlockProps {
  block: RadarChartBlock;
}

const BADGE_COLORS = ['blue', 'orange', 'teal', 'violet', 'pink', 'green', 'yellow', 'red'];

function RadarChartContent({ block, height }: { block: RadarChartBlock; height: number }): JSX.Element {
  const { data, series } = buildRadarChartInput(block.signals);
  return (
    <RadarChart
      h={height}
      data={data}
      dataKey="metric"
      series={series}
      withLegend={height > 180}
    />
  );
}

export const RadarChartBlockView = ({ block }: IRadarChartBlockProps): JSX.Element => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Paper p="sm" withBorder radius="md" mt="xs">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconChartRadar size={14} />
              <Text size="sm" fw={600}>{block.title}</Text>
            </Group>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setModalOpen(true)}
              title="Expand chart"
            >
              <IconMaximize size={14} />
            </ActionIcon>
          </Group>
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge key={index} size="xs" variant="light" color={BADGE_COLORS[index % BADGE_COLORS.length]}>
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <RadarChartContent block={block} height={200} />
        </Stack>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={block.title}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge key={index} size="sm" variant="light" color={BADGE_COLORS[index % BADGE_COLORS.length]}>
                {signal.fileName}
              </Badge>
            ))}
          </Group>
          <RadarChartContent block={block} height={360} />
          <Text size="xs" c="dimmed">
            Values are normalized per metric (100% = highest across compared files).
          </Text>
        </Stack>
      </Modal>
    </>
  );
};
