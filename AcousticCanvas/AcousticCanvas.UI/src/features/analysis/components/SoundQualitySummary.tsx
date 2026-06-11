import type { JSX } from 'react';
import { Badge, Box, Group, Loader, Stack, Text } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import type { SoundQualitySummaryResult } from '../hooks/useSoundQualitySummary';

interface SoundQualitySummaryProps {
  summary: SoundQualitySummaryResult | null;
  isLoading: boolean;
  error: string | null;
}

export const SoundQualitySummary = ({ summary, isLoading, error }: SoundQualitySummaryProps): JSX.Element => {
  if (isLoading) {
    return (
      <Box p="md">
        <Group justify="center">
          <Loader size="sm" color="teal" />
          <Text size="sm" c="dimmed">Loading sound quality summary...</Text>
        </Group>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Text size="sm" c="red">{error}</Text>
      </Box>
    );
  }

  if (!summary) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">No sound quality summary available</Text>
      </Box>
    );
  }

  const assessmentColor = summary.overallAssessment === 'Good' ? 'teal' : summary.overallAssessment === 'Fair' ? 'yellow' : 'red';
  const assessmentIcon = summary.overallAssessment === 'Good' ? <IconCheck size={16} /> : summary.overallAssessment === 'Fair' ? <IconAlertTriangle size={16} /> : <IconX size={16} />;

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600} c="dimmed">Overall Assessment</Text>
        <Badge size="lg" color={assessmentColor} variant="light" leftSection={assessmentIcon}>
          {summary.overallAssessment}
        </Badge>
      </Group>

      <Box>
        <Text size="sm" fw={600} c="dimmed" mb="xs">Key Findings</Text>
        <Stack gap="xs">
          {summary.keyFindings.map((finding, index) => (
            <Text key={index} size="xs" c="dimmed" style={{ paddingLeft: '8px', borderLeft: '2px solid var(--mantine-color-teal-4)' }}>
              {finding}
            </Text>
          ))}
        </Stack>
      </Box>

      <Box>
        <Text size="sm" fw={600} c="dimmed" mb="xs">Top Metrics</Text>
        <Stack gap="xs">
          {summary.topMetrics.map((metric) => (
            <Group key={metric.name} justify="space-between" align="center">
              <Text size="xs" c="dimmed">{metric.name}</Text>
              <Group gap="xs">
                <Text size="xs" fw={500} ff="var(--font-mono)">
                  {metric.value.toFixed(2)} {metric.unit}
                </Text>
                <Badge size="xs" color={metric.assessment === 'Good' ? 'teal' : metric.assessment === 'Fair' ? 'yellow' : 'red'} variant="light">
                  {metric.assessment}
                </Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      </Box>

      <Box>
        <Text size="sm" fw={600} c="dimmed" mb="xs">Recommendations</Text>
        <Stack gap="xs">
          {summary.recommendations.map((recommendation, index) => (
            <Text key={index} size="xs" c="dimmed" style={{ paddingLeft: '8px', borderLeft: '2px solid var(--mantine-color-blue-4)' }}>
              {recommendation}
            </Text>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};
