import type { JSX } from 'react';
import { Stack, Text, Tooltip, Group, Badge } from '@mantine/core';
import { IconVolume, IconWaveSawTool, IconRipple } from '@tabler/icons-react';
import type { SoundQualityAnalysis } from '../../types/soundQualityTypes';
import barStyles from '../SoundQualityPanel.module.scss';

interface ISoundQualityViewerProps {
  result: SoundQualityAnalysis;
}

interface ISoundQualityMetricBarsProps {
  result: SoundQualityAnalysis;
}

interface IMetricBar {
  label: string;
  value: number;
  unit: string;
  displayCeiling: number;
  fillPercent: number;
  fillColor: string;
  icon: typeof IconVolume;
}

const loudnessColor = '#00b8a9';
const sharpnessColor = '#f59f00';
const roughnessColor = '#845ef7';

export function SoundQualityViewer({ result }: ISoundQualityViewerProps): JSX.Element {
  return (
    <Stack gap="md">
      {/* Region info */}
      <Group gap="xs">
        <Badge variant="light" size="sm">
          {result.region.startSeconds.toFixed(2)} – {result.region.endSeconds.toFixed(2)} s
        </Badge>
        <Badge variant="light" size="sm">
          {result.parameters.method}
        </Badge>
      </Group>

      <SoundQualityMetricBars result={result} />

      {/* Limitations */}
      {result.parameters.limitations.length > 0 && (
        <div>
          <Text size="xs" c="dimmed" mb="xs">Analysis Notes</Text>
          <Stack gap="xs">
            {result.parameters.limitations.map((limitation, index) => (
              <Text key={index} size="xs" c="dimmed">
                • {limitation}
              </Text>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}

export function SoundQualityMetricBars({ result }: ISoundQualityMetricBarsProps): JSX.Element {
  const metricBars: IMetricBar[] = [
    {
      label: 'Loudness',
      value: result.loudness.value,
      unit: result.loudness.unit,
      displayCeiling: computeNiceDisplayCeiling(result.loudness.value),
      fillPercent: Math.min(
        (result.loudness.value / computeNiceDisplayCeiling(result.loudness.value)) * 100,
        100
      ),
      fillColor: loudnessColor,
      icon: IconVolume,
    },
    {
      label: 'Sharpness',
      value: result.sharpness.value,
      unit: result.sharpness.unit,
      displayCeiling: computeNiceDisplayCeiling(result.sharpness.value),
      fillPercent: Math.min(
        (result.sharpness.value / computeNiceDisplayCeiling(result.sharpness.value)) * 100,
        100
      ),
      fillColor: sharpnessColor,
      icon: IconWaveSawTool,
    },
    {
      label: 'Roughness',
      value: result.roughness.value,
      unit: result.roughness.unit,
      displayCeiling: computeNiceDisplayCeiling(result.roughness.value),
      fillPercent: Math.min(
        (result.roughness.value / computeNiceDisplayCeiling(result.roughness.value)) * 100,
        100
      ),
      fillColor: roughnessColor,
      icon: IconRipple,
    },
  ];

  return (
    <div className={barStyles.barChart}>
      {metricBars.map((metricBar) => (
        <div key={metricBar.label} className={barStyles.barRow}>
          <span className={barStyles.barRowLabel}>
            <metricBar.icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {metricBar.label}
          </span>
          <Tooltip
            label={`${metricBar.value.toFixed(2)} ${metricBar.unit} (scale 0 - ${metricBar.displayCeiling} ${metricBar.unit})`}
            withArrow
          >
            <div className={barStyles.barRowTrack}>
              <div
                className={barStyles.barRowFill}
                style={{ width: `${metricBar.fillPercent}%`, backgroundColor: metricBar.fillColor }}
              />
            </div>
          </Tooltip>
          <span className={barStyles.barRowValue}>
            {metricBar.value.toFixed(2)} {metricBar.unit}
          </span>
          <div className={barStyles.barRowAxis}>
            <span className={barStyles.barRowAxisTick}>0</span>
            <span className={barStyles.barRowAxisTick}>{formatAxisTickValue(metricBar.displayCeiling / 2)}</span>
            <span className={barStyles.barRowAxisTick}>{metricBar.displayCeiling} {metricBar.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function computeNiceDisplayCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1.5) {
    return 1.5 * magnitude;
  }
  if (normalized <= 3) {
    return 3 * magnitude;
  }
  if (normalized <= 7) {
    return 7 * magnitude;
  }
  return 10 * magnitude;
}

function formatAxisTickValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}
