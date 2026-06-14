import type { JSX } from 'react';
import { Paper, Skeleton, Stack } from '@mantine/core';

interface IBlockSkeletonProps {
  count?: number;
}

export function BlockSkeleton({ count = 2 }: IBlockSkeletonProps): JSX.Element {
  return (
    <Stack gap="md" mt="md">
      {Array.from({ length: count }).map((_, index) => (
        <Paper key={index} p="md" withBorder radius="md">
          <Skeleton height={20} width="40%" mb="md" />
          <Skeleton height={12} mb="xs" />
          <Skeleton height={12} width="80%" mb="xs" />
          <Skeleton height={12} width="60%" />
        </Paper>
      ))}
    </Stack>
  );
}
