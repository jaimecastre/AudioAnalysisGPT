import type { JSX } from 'react';
import { useState } from 'react';
import { Paper, Stack, Group, Text, Badge, ActionIcon, Modal, SimpleGrid } from '@mantine/core';
import { IconMicroscope, IconMaximize } from '@tabler/icons-react';
import type { InvestigationBlock, InvestigationSignal } from '../services/agentAskService';
import { AnalysisViewBlock } from './AnalysisViewBlock';

interface IInvestigationBlockViewProps {
  block: InvestigationBlock;
}

const VIEW_TYPE_COLORS: Record<string, string> = {
  spectrum: 'blue',
  spectrogram: 'violet',
  cpb: 'teal',
  soundQuality: 'orange',
  findings: 'red',
};

function buildAnalysisViewBlock(signal: InvestigationSignal) {
  return {
    blockType: 'analysisView' as const,
    viewType: signal.viewType as 'spectrum' | 'spectrogram' | 'cpb' | 'soundQuality' | 'findings',
    resultId: signal.resultId,
    fileId: signal.fileId,
    fileName: signal.fileName,
    summary: {},
    title: `${signal.viewType} — ${signal.fileName}`,
    preview: undefined,
    plotHints: signal.plotHints ?? null,
  };
}

export function InvestigationBlockView({ block }: IInvestigationBlockViewProps): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Paper p="sm" withBorder radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <IconMicroscope size={14} />
              <Text size="sm" fw={600}>Investigation</Text>
            </Group>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setModalOpen(true)}
              title="Expand investigation"
            >
              <IconMaximize size={14} />
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed" fs="italic">{block.diagnosticQuestion}</Text>
          <Group gap={4}>
            {block.signals.map((signal, index) => (
              <Badge
                key={index}
                size="xs"
                variant="light"
                color={VIEW_TYPE_COLORS[signal.viewType] ?? 'gray'}
              >
                {signal.viewType}
              </Badge>
            ))}
          </Group>
          <SimpleGrid cols={block.signals.length > 2 ? 2 : block.signals.length} spacing="xs">
            {block.signals.map((signal, index) => (
              <AnalysisViewBlock key={index} block={buildAnalysisViewBlock(signal)} />
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Investigation"
        size="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed" fs="italic">{block.diagnosticQuestion}</Text>
          {block.signals.map((signal, index) => (
            <AnalysisViewBlock key={index} block={buildAnalysisViewBlock(signal)} />
          ))}
        </Stack>
      </Modal>
    </>
  );
}
