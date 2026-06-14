import type { JSX } from 'react';
import { Table, Title, Badge } from '@mantine/core';
import type { RankedItem } from '../services/agentAskService';

interface IRankingBlockProps {
  title: string;
  rankedItems: RankedItem[];
}

export function RankingBlock({ title, rankedItems }: IRankingBlockProps): JSX.Element {
  if (!rankedItems || rankedItems.length === 0) {
    return (
      <div>
        <Title order={6} mb="xs">{title}</Title>
        <div>No ranking data available</div>
      </div>
    );
  }

  return (
    <div>
      <Title order={6} mb="xs">{title}</Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: '60px' }}>Rank</Table.Th>
            <Table.Th>File</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Score</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rankedItems.map((item) => (
            <Table.Tr key={item.fileId}>
              <Table.Td>
                <Badge
                  color={item.rank === 1 ? 'green' : item.rank === 2 ? 'blue' : 'gray'}
                  variant={item.rank === 1 ? 'filled' : 'light'}
                  size="sm"
                >
                  #{item.rank}
                </Badge>
              </Table.Td>
              <Table.Td style={{ fontWeight: item.rank === 1 ? 500 : 400 }}>
                {item.fileName}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {item.score.toFixed(2)} {item.scoreUnit ? item.scoreUnit : ''}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
