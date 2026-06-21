import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Loader, Select, Text, Tooltip } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChartBar, IconChevronDown, IconChevronRight, IconInfoCircle, IconSparkles, IconX } from '@tabler/icons-react';
import { useAppSelector } from '../../../store/reduxHooks';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { useRunSoundQuality } from '../hooks/useRunSoundQuality';
import { useSoundQualitySummary } from '../hooks/useSoundQualitySummary';
import type { SoundQualityAnalysis } from '../types/soundQualityTypes';
import type { SoundQualitySummaryResult } from '../hooks/useSoundQualitySummary';
import { SoundQualitySummary } from './SoundQualitySummary';
import { MetricRankingModal } from './MetricRankingModal';
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
const roughnessBarColor = '#845ef7';

const METRIC_TOOLTIPS: Record<string, string> = {
  Loudness: 'Psychoacoustic loudness (Zwicker). Measures perceived volume accounting for frequency sensitivity. Unit: sone. Higher = louder.',
  Sharpness: 'Spectral sharpness (von Bismarck). Measures how much high-frequency content contributes to harshness. Unit: acum. Higher = brighter/harsher.',
  Roughness: 'Amplitude modulation roughness (Daniel & Weber). Measures fast fluctuations (15–300 Hz AM) that create an unpleasant grating sensation. Unit: asper. Higher = rougher.',
};

interface ISoundQualityPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string; durationSeconds: number }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
  isWide: boolean;
  onToggleSpan: (panelId: string) => void;
}

export const SoundQualityPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
  isWide,
  onToggleSpan,
}: ISoundQualityPanelProps): JSX.Element => {
  const activeSelection = useAppSelector(activeSelectionSelector);
  const { result, isRunning, error, runSoundQuality, resetSoundQuality } = useRunSoundQuality();
  const { runSoundQualitySummary } = useSoundQualitySummary();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);
  const [summary, setSummary] = useState<SoundQualitySummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [rankingModalOpened, setRankingModalOpened] = useState(false);

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

  // Clear data when file changes to prevent showing stale data from previous file.
  useEffect(() => {
    resetSoundQuality();
  }, [effectiveFileId, resetSoundQuality]);

  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    const timeoutId = window.setTimeout(() => {
      runSoundQuality({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, runSoundQuality, isCollapsed]);

  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    if (result) return;
    const timeoutId = window.setTimeout(() => {
      runSoundQuality({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, runSoundQuality, result, isCollapsed]);

  // Clear data when panel collapses to free memory.
  useEffect(() => {
    if (isCollapsed) {
      resetSoundQuality();
    }
  }, [isCollapsed, resetSoundQuality]);

  useEffect(() => {
    if (!effectiveFileId || !result) return;
    if (summary && summary.fileId === effectiveFileId) return;
    const fetchSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const summaryResult = await runSoundQualitySummary({ fileId: effectiveFileId });
        setSummary(summaryResult);
      } catch (error) {
        setSummaryError(error instanceof Error ? error.message : 'Failed to load sound quality summary');
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchSummary();
  }, [effectiveFileId, result, runSoundQualitySummary, summary]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 120 }}>
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
              style={{ flex: 1, minWidth: 100, maxWidth: 220 }}
              styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
              comboboxProps={{ withinPortal: true, width: 240 }}
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
          {availableFiles.length > 1 && (
            <Button
              size="xs"
              variant="subtle"
              color="teal"
              leftSection={<IconChartBar size={13} />}
              onClick={() => setRankingModalOpened(true)}
            >
              Compare
            </Button>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onToggleSpan(panelId)} aria-label={isWide ? 'Restore panel width' : 'Widen panel to full width'}>
            {isWide ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={13} />}
          </ActionIcon>
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
                  <Tooltip
                    label={METRIC_TOOLTIPS[metricBar.label] ?? metricBar.label}
                    withArrow
                    position="right"
                    multiline
                    w={240}
                  >
                    <span className={barStyles.barRowLabel}>
                      <span className={barStyles.barRowSwatch} style={{ backgroundColor: metricBar.fillColor }} />
                      {metricBar.label}
                    </span>
                  </Tooltip>
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
            <SoundQualitySummary summary={summary} isLoading={summaryLoading} error={summaryError} />
            <div className={styles.summaryHeader}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setIsInfoCollapsed((value) => !value)}
                aria-label={isInfoCollapsed ? 'Show analysis details' : 'Hide analysis details'}
              >
                <IconInfoCircle size={13} />
              </ActionIcon>
            </div>
            {!isInfoCollapsed && (
              <div className={styles.summary}>
                <span>
                  Method <span className={styles.summaryValue}>{result.parameters.method}</span>
                </span>
                {result.parameters.limitations.map((limitation) => (
                  <span key={limitation}>
                    Note <span className={styles.summaryValue}>{limitation}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <MetricRankingModal
        opened={rankingModalOpened}
        onClose={() => setRankingModalOpened(false)}
        availableFiles={availableFiles}
      />
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
  const roughnessCeiling = computeNiceDisplayCeiling(analysis.roughness.value);
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
    {
      label: 'Roughness',
      value: analysis.roughness.value,
      unit: analysis.roughness.unit,
      displayCeiling: roughnessCeiling,
      fillPercent: computeBarFillPercent(analysis.roughness.value, roughnessCeiling),
      fillColor: roughnessBarColor,
    },
  ];
};
