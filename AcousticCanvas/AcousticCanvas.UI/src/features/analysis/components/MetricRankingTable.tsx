import type { JSX } from 'react';
import { Badge, Box, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import type { MetricRankingResult } from '../hooks/useMetricRanking';

interface MetricRankingTableProps {
  rankings: MetricRankingResult | null;
  isLoading: boolean;
  error: string | null;
}

export const MetricRankingTable = ({ rankings, isLoading, error }: MetricRankingTableProps): JSX.Element => {
  if (isLoading) {
    return (
      <Box p="md">
        <Group justify="center">
          <Loader size="sm" color="teal" />
          <Text size="sm" c="dimmed">Loading metric rankings...</Text>
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

  if (!rankings || rankings.rankings.length === 0) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">No metric rankings available</Text>
      </Box>
    );
  }

  const groupedByMetric = rankings.rankings.reduce((acc, row) => {
    if (!acc[row.metricName]) {
      acc[row.metricName] = [];
    }
    acc[row.metricName].push(row);
    return acc;
  }, {} as Record<string, typeof rankings.rankings>);

  const metricGroups = Object.entries(groupedByMetric).map(([metricName, rows]) => {
    const sortedRows = rows.sort((a, b) => a.rank - b.rank);

    const tableRows = sortedRows.map((row) => (
      <Table.Tr key={`${row.fileId}-${row.metricName}`}>
        <Table.Td>
          <Badge size="sm" variant="light" color="teal">
            #{row.rank}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="xs" fw={500} truncate style={{ maxWidth: 200 }}>
            {row.fileName}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="xs" fw={500} ff="var(--font-mono)">
            {row.value.toFixed(2)} {row.unit}
          </Text>
        </Table.Td>
      </Table.Tr>
    ));

    return (
      <Box key={metricName} mb="xl">
        <Title order={6} mb="xs" c="dimmed">
          {metricName}
        </Title>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '60px' }}>Rank</Table.Th>
              <Table.Th>File</Table.Th>
              <Table.Th>Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{tableRows}</Table.Tbody>
        </Table>
      </Box>
    );
  });

  return (
    <Box p="md">
      <Stack gap="xl">
        {metricGroups}
      </Stack>
    </Box>
  );
};
