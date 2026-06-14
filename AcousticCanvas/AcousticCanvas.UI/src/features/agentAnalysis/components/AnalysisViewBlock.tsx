import type { JSX } from 'react';
import { useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  ActionIcon,
  Modal,
  Loader,
  Alert,
} from '@mantine/core';
import {
  IconChartLine,
  IconWaveSine,
  IconVolume,
  IconAlertCircle,
  IconMaximize,
  IconExternalLink,
  IconChartBar,
} from '@tabler/icons-react';
import type { AnalysisViewBlock as AnalysisViewBlockType } from '../services/agentAskService';
import { useAnalysisResult } from '../../analysis/hooks/useAnalysisResult';
import { SpectrumViewer } from '../../analysis/components/viewers/SpectrumViewer';
import { SoundQualityViewer } from '../../analysis/components/viewers/SoundQualityViewer';
import { CpbViewer } from '../../analysis/components/viewers/CpbViewer';
import { FindingsViewer } from '../../analysis/components/viewers/FindingsViewer';
import { SpectrumCanvas } from '../../analysis/components/SpectrumCanvas';

interface IAnalysisViewBlockProps {
  block: AnalysisViewBlockType;
}

const VIEW_ICONS: Record<string, typeof IconChartLine> = {
  spectrum: IconChartLine,
  spectrogram: IconWaveSine,
  cpb: IconChartBar,
  soundQuality: IconVolume,
  findings: IconAlertCircle,
};

const VIEW_LABELS: Record<string, string> = {
  spectrum: 'Spectrum Analysis',
  spectrogram: 'Spectrogram',
  cpb: 'CPB Analysis',
  soundQuality: 'Sound Quality',
  findings: 'Findings',
};

function AnalysisViewModalContent({
  viewType,
  resultId,
}: {
  viewType: string;
  resultId: string;
}): JSX.Element {
  const { result, isLoading, error } = useAnalysisResult(resultId);

  if (isLoading) {
    return (
      <Stack align="center" gap="md" py="xl">
        <Loader size="lg" color="blue" />
        <Text c="dimmed">Loading analysis results...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        <Text size="sm">Failed to load analysis: {error}</Text>
      </Alert>
    );
  }

  if (!result) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
        <Text size="sm">Analysis result not found. The data may have expired.</Text>
      </Alert>
    );
  }

  // Render the appropriate viewer based on result type
  if (result.type === 'spectrum' && viewType === 'spectrum') {
    return <SpectrumViewer result={result.data} />;
  }

  if (result.type === 'soundQuality' && viewType === 'soundQuality') {
    return <SoundQualityViewer result={result.data} />;
  }

  if (result.type === 'cpb' && viewType === 'cpb') {
    return <CpbViewer result={result.data} />;
  }

  if (result.type === 'findings' && viewType === 'findings') {
    return <FindingsViewer result={result.data} />;
  }

  // Type mismatch between result and requested viewType
  return (
    <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
      <Text size="sm">
        Result type mismatch: expected {viewType} but got {result.type}
      </Text>
    </Alert>
  );
}

export function AnalysisViewBlock({ block }: IAnalysisViewBlockProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const Icon = VIEW_ICONS[block.viewType] || IconChartLine;
  const title = block.title || VIEW_LABELS[block.viewType] || 'Analysis';
  const { summary } = block;

  return (
    <>
      {/* Compact Inline Card */}
      <Paper
        p="md"
        withBorder
        radius="md"
        className="analysis-view-block"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsModalOpen(true)}
      >
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <ActionIcon variant="light" color="blue" size="sm">
              <Icon size={16} />
            </ActionIcon>
            <div>
              <Title order={6} mb={2}>{title}</Title>
              <Text size="xs" c="dimmed">{block.fileName}</Text>
            </div>
          </Group>
          <ActionIcon variant="subtle" color="gray" size="sm">
            <IconMaximize size={16} />
          </ActionIcon>
        </Group>

        {/* Summary Content — show primaryMetric only when there are no secondaryMetrics */}
        {summary.primaryMetric && (!summary.secondaryMetrics || summary.secondaryMetrics.length === 0) && (
          <Text size="lg" fw={600} c="blue.7" mb="xs">
            {summary.primaryMetric}
          </Text>
        )}

        {summary.secondaryMetrics && summary.secondaryMetrics.length > 0 && (
          <Group gap="md" mb="sm">
            {summary.secondaryMetrics.map((metric, idx) => (
              <Stack key={idx} gap={0}>
                <Text size="xs" c="dimmed">{metric.label}</Text>
                <Text size="sm" fw={500}>
                  {metric.value}{metric.unit ? ` ${metric.unit}` : ''}
                </Text>
              </Stack>
            ))}
          </Group>
        )}

        {summary.statusText && (
          <Group gap="xs">
            <Badge
              size="sm"
              color={summary.statusIndicator === 'success' ? 'green' :
                    summary.statusIndicator === 'warning' ? 'yellow' :
                    summary.statusIndicator === 'error' ? 'red' : 'blue'}
              variant="light"
            >
              {summary.statusText}
            </Badge>
          </Group>
        )}

        {/* Mini Chart Preview */}
        {block.preview?.frequenciesHz && block.preview?.magnitudesDb && (
          <div style={{ height: 100, width: '100%', marginTop: 12, marginBottom: 8 }}>
            <SpectrumCanvas
              channels={[{
                channelId: '1',
                channelName: 'Channel 1',
                points: block.preview.frequenciesHz.map((freq, i) => [freq, block.preview?.magnitudesDb?.[i] ?? -120]),
                yUnit: 'dB',
                yAxisLabel: 'Level [dB]',
                originalIndex: 0,
              }]}
            />
          </div>
        )}

        {/* Mini Hint */}
        <Text size="xs" c="dimmed" mt="sm" style={{ textAlign: 'center' }}>
          <IconExternalLink size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Click to open full analysis
        </Text>
      </Paper>

      {/* Full Modal View */}
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${title} — ${block.fileName}`}
        size="xl"
        centered
      >
        <AnalysisViewModalContent viewType={block.viewType} resultId={block.resultId} />
      </Modal>
    </>
  );
}
