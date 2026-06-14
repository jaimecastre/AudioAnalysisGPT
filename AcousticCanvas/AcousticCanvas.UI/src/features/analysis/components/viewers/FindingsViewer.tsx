import type { JSX } from 'react';
import { Stack, Text, Alert, Group, Badge, Timeline } from '@mantine/core';
import {
  IconAlertCircle,
  IconVolume,
  IconWaveSine,
  IconChartBar,
  IconQuestionMark,
} from '@tabler/icons-react';
import type { FindingsResult } from '../../../findings/types/findingsTypes';

interface IFindingsViewerProps {
  result: FindingsResult;
}

const findingTypeIcons: Record<string, typeof IconAlertCircle> = {
  clipping: IconVolume,
  silence: IconWaveSine,
  level: IconChartBar,
  default: IconQuestionMark,
};

const severityColors: Record<string, string> = {
  high: 'red',
  medium: 'yellow',
  low: 'blue',
};

export function FindingsViewer({ result }: IFindingsViewerProps): JSX.Element {
  const findings = result.findings;

  if (findings.length === 0) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="green" variant="light">
        <Text size="sm">No issues detected in this file.</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge color="blue" variant="light">
          {result.findingCount} findings
        </Badge>
        <Badge color="gray" variant="light">
          {new Date(result.ranAt).toLocaleTimeString()}
        </Badge>
      </Group>

      <Timeline bulletSize={24} lineWidth={2}>
        {findings.map((finding) => {
          const Icon = findingTypeIcons[finding.type] ?? findingTypeIcons.default;
          const color = severityColors[finding.severity] ?? 'gray';

          return (
            <Timeline.Item
              key={finding.findingId}
              bullet={<Icon size={14} />}
              color={color}
              title={
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {finding.title}
                  </Text>
                  <Badge size="xs" color={color} variant="light">
                    {finding.severity}
                  </Badge>
                  <Badge size="xs" variant="outline">
                    {finding.confidence}
                  </Badge>
                </Group>
              }
            >
              <Text size="xs" c="dimmed" mb="xs">
                {finding.description}
              </Text>

              {finding.startSeconds !== null && finding.endSeconds !== null && (
                <Text size="xs" c="dimmed">
                  Time: {finding.startSeconds.toFixed(2)} – {finding.endSeconds.toFixed(2)} s
                </Text>
              )}

              {finding.frequencyHz !== null && (
                <Text size="xs" c="dimmed">
                  Frequency: {finding.frequencyHz.toFixed(0)} Hz
                </Text>
              )}

              {finding.suggestedNextStep && (
                <Text size="xs" c="blue" mt="xs">
                  Suggestion: {finding.suggestedNextStep}
                </Text>
              )}
            </Timeline.Item>
          );
        })}
      </Timeline>
    </Stack>
  );
}
