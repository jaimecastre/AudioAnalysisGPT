import type { JSX } from 'react';
import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { IconChartBar } from '@tabler/icons-react';
import { MetricRankingTable } from './MetricRankingTable';
import { useMetricRanking } from '../hooks/useMetricRanking';
import type { MetricRankingResult } from '../hooks/useMetricRanking';

interface IMetricRankingModalProps {
  opened: boolean;
  onClose: () => void;
  availableFiles: Array<{ id: string; name: string }>;
}

export const MetricRankingModal = ({ opened, onClose, availableFiles }: IMetricRankingModalProps): JSX.Element => {
  const { runMetricRanking } = useMetricRanking();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['loudness', 'sharpness', 'roughness']);
  const [rankings, setRankings] = useState<MetricRankingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics((prev) => prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]);
  };

  const handleFetchRankings = async () => {
    if (selectedMetrics.length === 0) {
      setError('Please select at least one metric');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRankings(null);

    try {
      const fileIds = availableFiles.map((file) => file.id);
      const result = await runMetricRanking({ fileIds, metrics: selectedMetrics });
      setRankings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metric rankings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setRankings(null);
    setError(null);
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Compare Sound Quality Metrics">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select metrics to compare across all available files. Rankings are ordered from highest to lowest value.
        </Text>

        <Group gap="xs">
          <Checkbox
            label="Loudness"
            checked={selectedMetrics.includes('loudness')}
            onChange={() => handleMetricToggle('loudness')}
          />
          <Checkbox
            label="Sharpness"
            checked={selectedMetrics.includes('sharpness')}
            onChange={() => handleMetricToggle('sharpness')}
          />
          <Checkbox
            label="Roughness"
            checked={selectedMetrics.includes('roughness')}
            onChange={() => handleMetricToggle('roughness')}
          />
        </Group>

        <Button onClick={handleFetchRankings} loading={isLoading} leftSection={<IconChartBar size={16} />}>
          Fetch Rankings
        </Button>

        {error && <Text size="sm" c="red">{error}</Text>}

        {rankings && <MetricRankingTable rankings={rankings} isLoading={false} error={null} />}
      </Stack>
    </Modal>
  );
};
