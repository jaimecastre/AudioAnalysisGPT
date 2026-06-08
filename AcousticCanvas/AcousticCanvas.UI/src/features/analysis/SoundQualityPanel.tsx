import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Group, Loader, Select, Text, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconSparkles, IconX } from '@tabler/icons-react';
import { useAppSelector } from '../../store/reduxHooks';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { useRunSoundQuality } from './useRunSoundQuality';
import type { SoundQualityAnalysis } from './soundQualityTypes';
import styles from './CpbPanel.module.scss';
import barStyles from './SoundQualityPanel.module.scss';

type SoundQualityMetricBar = {
  label: string;
  value: number;
  unit: string;
  displayCeiling: number;
  fillPercent: number;
  fillColor: string;
};

const loudnessBarColor = '#00b8a9';
const sharpnessBarColor = '#f59f00';

interface SoundQualityPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string; durationSeconds: number }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
}

export const SoundQualityPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
}: SoundQualityPanelProps): JSX.Element => {
  const activeSelection = useAppSelector(activeSelectionSelector);
  const { result, isRunning, error, runSoundQuality } = useRunSoundQuality();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const effectiveFileId = selectedFileId ?? availableFiles[0]?.id ?? null;
  const selectedFile = availableFiles.find((file) => file.id === effectiveFileId);
  const hasRegion = Boolean(activeSelection && activeSelection.endSeconds > activeSelection.startSeconds);
  const regionStartSeconds = activeSelection?.startSeconds;
  const regionEndSeconds = activeSelection?.endSeconds;
  const metricBars = result ? buildSoundQualityMetricBars(result) : [];

  useEffect(() => {
    if (!selectedFileId && effectiveFileId) {
      onFileSelect(panelId, effectiveFileId);
    }
  }, [effectiveFileId, onFileSelect, panelId, selectedFileId]);

  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    const timeoutId = window.setTimeout(() => {
      runSoundQuality({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, runSoundQuality]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <IconSparkles size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Sound Quality
          </Text>
          {availableFiles.length > 1 ? (
            <Select
              size="xs"
              placeholder="Select file..."
              data={availableFiles.map((file) => ({ value: file.id, label: file.name }))}
              value={effectiveFileId}
              onChange={(value) => onFileSelect(panelId, value)}
              style={{ flex: 1, minWidth: 0, maxWidth: 220 }}
              styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
            />
          ) : (
            <Text size="xs" ff="var(--font-mono)" truncate style={{ maxWidth: 220 }}>
              {selectedFile?.name ?? 'No file'}
            </Text>
          )}
          <Badge size="xs" variant="light" color={hasRegion ? 'teal' : 'gray'}>
            {hasRegion
              ? `${activeSelection!.startSeconds.toFixed(3)}s - ${activeSelection!.endSeconds.toFixed(3)}s`
              : 'Full file'}
          </Badge>
          {isRunning && <Loader size="xs" color="teal" />}
        </Group>
        <Group gap={2}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand sound-quality panel' : 'Collapse sound-quality panel'}>
            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onClose(panelId)} aria-label="Close sound-quality panel">
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </div>

      <div className={styles.panelBody} style={{ display: isCollapsed ? 'none' : undefined }}>
        {!effectiveFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run sound-quality metrics</Text>
          </div>
        )}
        {effectiveFileId && error && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{error}</Text>
          </div>
        )}
        {effectiveFileId && !error && result && (
          <>
            <div className={barStyles.barChart}>
              {metricBars.map((metricBar) => (
                <div key={metricBar.label} className={barStyles.barRow}>
                  <span className={barStyles.barRowLabel}>
                    <span className={barStyles.barRowSwatch} style={{ backgroundColor: metricBar.fillColor }} />
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
                  <span className={barStyles.barRowValue}>{metricBar.value.toFixed(2)} {metricBar.unit}</span>
                  <div className={barStyles.barRowAxis}>
                    <span className={barStyles.barRowAxisTick}>0</span>
                    <span className={barStyles.barRowAxisTick}>{formatAxisTickValue(metricBar.displayCeiling / 2)}</span>
                    <span className={barStyles.barRowAxisTick}>{metricBar.displayCeiling} {metricBar.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.summary}>
              <span>
                Method <span className={styles.summaryValue}>{result.parameters.method}</span>
              </span>
              {result.parameters.limitations[0] && (
                <span>
                  Note <span className={styles.summaryValue}>{result.parameters.limitations[0]}</span>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const computeNiceDisplayCeiling = (value: number): number => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalizedValue = value / magnitude;
  if (normalizedValue <= 1) {
    return 1 * magnitude;
  }
  if (normalizedValue <= 2) {
    return 2 * magnitude;
  }
  if (normalizedValue <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
};

const computeBarFillPercent = (value: number, displayCeiling: number): number => {
  if (displayCeiling <= 0) {
    return 0;
  }
  const rawPercent = (value / displayCeiling) * 100;
  if (rawPercent < 0) {
    return 0;
  }
  if (rawPercent > 100) {
    return 100;
  }
  return rawPercent;
};

const formatAxisTickValue = (tickValue: number): string => {
  if (Number.isInteger(tickValue)) {
    return String(tickValue);
  }
  return tickValue.toFixed(1);
};

const buildSoundQualityMetricBars = (analysis: SoundQualityAnalysis): SoundQualityMetricBar[] => {
  const loudnessCeiling = computeNiceDisplayCeiling(analysis.loudness.value);
  const sharpnessCeiling = computeNiceDisplayCeiling(analysis.sharpness.value);
  return [
    {
      label: 'Loudness',
      value: analysis.loudness.value,
      unit: analysis.loudness.unit,
      displayCeiling: loudnessCeiling,
      fillPercent: computeBarFillPercent(analysis.loudness.value, loudnessCeiling),
      fillColor: loudnessBarColor,
    },
    {
      label: 'Sharpness',
      value: analysis.sharpness.value,
      unit: analysis.sharpness.unit,
      displayCeiling: sharpnessCeiling,
      fillPercent: computeBarFillPercent(analysis.sharpness.value, sharpnessCeiling),
      fillColor: sharpnessBarColor,
    },
  ];
};
