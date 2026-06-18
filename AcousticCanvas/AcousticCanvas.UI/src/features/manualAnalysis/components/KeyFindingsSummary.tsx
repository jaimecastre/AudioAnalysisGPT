import type { JSX } from 'react';
import { IconAlertTriangle, IconChartBar, IconVolume, IconWaveSine, IconBug, IconArrowRight } from '@tabler/icons-react';
import { ActionIcon, Badge, Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import type { AnalysisResult } from '../../analysis/types/analysisTypes';
import type { SpectrumPointsResponse } from '../../analysis/types/spectrumTypes';
import styles from './KeyFindingsSummary.module.scss';

type FindingSeverity = 'low' | 'medium' | 'high';

interface Finding {
  findingId: string;
  findingType?: string;
  type?: string;
  severity: FindingSeverity;
  title: string;
  description: string;
}

interface IKeyFindingsSummaryProps {
  activeFile: { id: string; name: string } | null;
  analysisResult: AnalysisResult | null;
  spectrumResult: SpectrumPointsResponse | null;
  findings: Finding[];
  onViewFindings: () => void;
  onAnalyzeLoudestRegion: () => void;
  onInspectSpectrum: () => void;
}

export function KeyFindingsSummary({
  activeFile,
  analysisResult,
  spectrumResult,
  findings,
  onViewFindings,
  onAnalyzeLoudestRegion,
  onInspectSpectrum,
}: IKeyFindingsSummaryProps): JSX.Element | null {
  if (!activeFile) {
    return null;
  }

  const highSeverityCount = findings.filter((f) => f.severity === 'high').length;
  const mediumSeverityCount = findings.filter((f) => f.severity === 'medium').length;
  const totalIssues = findings.length;

  const getFindingType = (finding: Finding): string => finding.findingType ?? finding.type ?? '';
  const hasClipping = findings.some((f) => getFindingType(f) === 'clipping');
  const hasTonalPeak = findings.some((f) => getFindingType(f) === 'tonal_peak');
  const hasSilence = findings.some((f) => getFindingType(f) === 'silence');

  const rmsDb = analysisResult?.level?.channels[0]?.rmsDb;
  const peakDb = analysisResult?.level?.channels[0]?.peakDb;
  const crestFactorDb = analysisResult?.level?.channels[0]?.crestFactorDb;
  const peakFrequencyHz = spectrumResult?.channels[0]?.peakFrequencyHz;

  const hasHighCrestFactor = crestFactorDb !== null && crestFactorDb !== undefined && crestFactorDb > 15;

  const issueSummary = totalIssues > 0
    ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`
    : 'No issues detected';

  const severityBadge = totalIssues > 0 ? (
    <Group gap={4}>
      {highSeverityCount > 0 && (
        <Badge color="red" size="sm" variant="filled">
          {highSeverityCount} high
        </Badge>
      )}
      {mediumSeverityCount > 0 && (
        <Badge color="yellow" size="sm" variant="filled">
          {mediumSeverityCount} medium
        </Badge>
      )}
      {totalIssues > 0 && highSeverityCount === 0 && mediumSeverityCount === 0 && (
        <Badge color="green" size="sm" variant="filled">
          {totalIssues} low
        </Badge>
      )}
    </Group>
  ) : (
    <Badge color="green" size="sm" variant="light">
      ✓ Clean
    </Badge>
  );

  return (
    <Paper className={styles.summaryContainer} p="md" radius="md" withBorder>
      <Stack gap="md">
        {/* Main metrics row */}
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="lg" align="center">
            {/* Issue summary */}
            <Group gap="xs" align="center">
              <IconAlertTriangle size={20} className={totalIssues > 0 ? styles.warningIcon : styles.successIcon} />
              <Text fw={600} size="sm">
                {issueSummary}
              </Text>
              {severityBadge}
            </Group>

            {/* Key metrics */}
            {rmsDb !== null && rmsDb !== undefined && (
              <Tooltip label="RMS level (average loudness)">
                <Group gap={4} align="center" className={styles.metric}>
                  <IconVolume size={16} className={styles.metricIcon} />
                  <Text size="sm" fw={500}>
                    {rmsDb.toFixed(1)} dB
                  </Text>
                  <Text size="xs" c="dimmed">
                    RMS
                  </Text>
                </Group>
              </Tooltip>
            )}

            {peakDb !== null && peakDb !== undefined && (
              <Tooltip label="Peak level (maximum amplitude)">
                <Group gap={4} align="center" className={styles.metric}>
                  <IconChartBar size={16} className={styles.metricIcon} />
                  <Text size="sm" fw={500}>
                    {peakDb.toFixed(1)} dB
                  </Text>
                  <Text size="xs" c="dimmed">
                    Peak
                  </Text>
                </Group>
              </Tooltip>
            )}

            {peakFrequencyHz !== null && peakFrequencyHz !== undefined && (
              <Tooltip label="Dominant frequency">
                <Group gap={4} align="center" className={styles.metric}>
                  <IconWaveSine size={16} className={styles.metricIcon} />
                  <Text size="sm" fw={500}>
                    {peakFrequencyHz.toFixed(0)} Hz
                  </Text>
                  <Text size="xs" c="dimmed">
                    Freq
                  </Text>
                </Group>
              </Tooltip>
            )}
          </Group>

          {/* Primary actions */}
          <Group gap="xs">
            {totalIssues > 0 && (
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconBug size={14} />}
                onClick={onViewFindings}
              >
                View Findings
              </Button>
            )}
            {rmsDb !== null && rmsDb !== undefined && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconVolume size={14} />}
                onClick={onAnalyzeLoudestRegion}
              >
                Analyze Loudest
              </Button>
            )}
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={onInspectSpectrum}
              aria-label="Inspect spectrum"
            >
              <IconArrowRight size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Suggested next steps based on findings */}
        {(hasClipping || hasTonalPeak || hasSilence || hasHighCrestFactor) && (
          <Paper className={styles.suggestions} p="sm" radius="sm">
            <Text size="xs" fw={600} c="dimmed" mb={8}>
              Suggested next steps
            </Text>
            <Group gap="xs" wrap="wrap">
              {hasClipping && (
                <Button size="xs" variant="subtle" color="red" leftSection={<IconAlertTriangle size={14} />}>
                  Inspect Clipping
                </Button>
              )}
              {hasTonalPeak && (
                <Button size="xs" variant="subtle" color="blue" leftSection={<IconWaveSine size={14} />}>
                  Analyze Tonal Peak
                </Button>
              )}
              {hasSilence && (
                <Button size="xs" variant="subtle" color="gray" leftSection={<IconVolume size={14} />}>
                  Check Silence Gaps
                </Button>
              )}
              {hasHighCrestFactor && (
                <Button size="xs" variant="subtle" color="orange" leftSection={<IconChartBar size={14} />}>
                  Check Dynamic Range
                </Button>
              )}
            </Group>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
