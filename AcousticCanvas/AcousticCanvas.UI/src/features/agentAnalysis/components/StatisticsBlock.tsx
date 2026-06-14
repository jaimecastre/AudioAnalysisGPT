import type { JSX } from 'react';
import { Table, Title, Paper, Text } from '@mantine/core';
import type { StatisticRow } from '../services/agentAskService';

interface IStatisticsBlockProps {
  title: string;
  rows: StatisticRow[];
}

export function StatisticsBlock({ title, rows }: IStatisticsBlockProps): JSX.Element {
  if (!rows || rows.length === 0) {
    return (
      <Paper p="sm" withBorder>
        <Title order={6}>{title}</Title>
        <Text size="sm" c="dimmed" mt="xs">No statistics available</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder radius="md">
      <Title order={6} mb="sm">{title}</Title>
      <Table variant="vertical" layout="fixed" withRowBorders={false}>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={index}>
              <Table.Td w="50%" c="dimmed" style={{ fontSize: 14 }}>{row.label}</Table.Td>
              <Table.Td w="50%" ta="right" fw={500} style={{ fontSize: 14 }}>
                {row.value}{row.unit ? ` ${row.unit}` : ''}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
