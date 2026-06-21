import type { JSX } from 'react';
import { Badge, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconRoute, IconTool } from '@tabler/icons-react';
import type { WorkflowBlock, WorkflowStep } from '../services/agentAskService';

interface IWorkflowBlockViewProps {
  block: WorkflowBlock;
}

function formatEvidenceType(evidenceType: string): string {
  return evidenceType.replaceAll('_', ' ');
}

function WorkflowStepRow({ step }: { step: WorkflowStep }): JSX.Element {
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <ThemeIcon size="sm" radius="xl" variant="light" color="blue">
        <Text size="xs" fw={700}>{step.stepNumber}</Text>
      </ThemeIcon>
      <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} wrap="wrap">
          <Badge size="xs" variant="light" color="blue" leftSection={<IconTool size={10} />}>
            {step.toolName}
          </Badge>
          <Badge size="xs" variant="outline" color="gray">
            {formatEvidenceType(step.evidenceType)}
          </Badge>
          <Text size="xs" c="dimmed" truncate>
            {step.fileName}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {step.description}
        </Text>
        {step.resultId ? (
          <Text size="xs" c="dimmed" ff="monospace">
            {step.resultId}
          </Text>
        ) : null}
      </Stack>
    </Group>
  );
}

export const WorkflowBlockView = ({ block }: IWorkflowBlockViewProps): JSX.Element => {
  const steps = Array.isArray(block.steps) ? block.steps : [];

  return (
    <Paper p="sm" withBorder radius="md" mt="xs">
      <Stack gap="sm">
        <Group gap="xs" align="center">
          <IconRoute size={15} />
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="sm" fw={700}>{block.title}</Text>
            <Text size="xs" c="dimmed" truncate>{block.question}</Text>
          </Stack>
        </Group>
        <Stack gap="xs">
          {steps.map((step) => (
            <WorkflowStepRow key={`${step.stepNumber}-${step.toolName}-${step.resultId ?? step.evidenceType}`} step={step} />
          ))}
          {steps.length === 0 ? (
            <Text size="xs" c="dimmed">
              Workflow steps were not included in this response.
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
};
