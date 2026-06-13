import type { JSX } from 'react';
import { Text, Select, Alert, Loader, Stack, Tooltip, Group, TextInput } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconChartLine, IconCursorText, IconInfoCircle, IconRefresh } from '@tabler/icons-react';
import type { SpectrumPointsResponse, SpectrumUserParameters } from '../types/spectrumTypes';
import { FFT_SIZE_OPTIONS } from '../types/spectrumTypes';
import type { SpectrumStatus } from '../store/spectrumSlice';
import type { WaveformSelection } from '../../waveform/store/waveformSelectionSlice';
import { SpectrumCanvas } from './SpectrumCanvas';
import styles from './SpectrumCard.module.scss';

interface ISpectrumCardProps {
  result: SpectrumPointsResponse | null;
  status: SpectrumStatus;
  error: string | null;
  activeSelection: WaveformSelection | null;
  userParameters: SpectrumUserParameters;
  showCanvas?: boolean;
  onSetFftSize: (fftSize: number) => void;
  onSetZoomRange: (minFrequencyHz: number | null, maxFrequencyHz: number | null) => void;
}

export const SpectrumCard = ({
  result,
  status,
  error,
  activeSelection,
  userParameters,
  showCanvas = true,
  onSetFftSize,
  onSetZoomRange,
}: ISpectrumCardProps): JSX.Element => {
  const hasSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  // Check if current FFT params differ from result
  const fftParamsDiffer = result && result.parameters.fftSize !== userParameters.fftSize;

  const firstChannel = result?.channels[0];
  const binSpacingHz = firstChannel && firstChannel.points.length > 1
    ? (firstChannel.points[1][0] - firstChannel.points[0][0]).toFixed(2)
    : null;

  const tonalPeaks = result
    ? result.channels
        .flatMap((channel) => channel.tonalPeaks.map((peak) => ({ ...peak, channelName: channel.channelName })))
        .sort((a, b) => b.prominenceDb - a.prominenceDb)
        .slice(0, 3)
    : [];

  return (
    <div className={styles.card}>
      {/* Controls row */}
      <div className={styles.controls}>
        <Select
          size="xs"
          label="FFT size"
          value={String(userParameters.fftSize)}
          data={FFT_SIZE_OPTIONS}
          onChange={(val) => val && onSetFftSize(Number(val))}
          classNames={{ root: styles.selectRoot }}
        />
        <TextInput
          size="xs"
          label="Min Hz"
          placeholder="0"
          value={userParameters.minFrequencyHz ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value;
            const parsed = value === '' ? null : Number(value);
            if (value === '' || (!isNaN(parsed) && parsed !== null && parsed >= 0)) {
              onSetZoomRange(parsed, userParameters.maxFrequencyHz);
            }
          }}
          style={{ width: 80 }}
        />
        <TextInput
          size="xs"
          label="Max Hz"
          placeholder="auto"
          value={userParameters.maxFrequencyHz ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value;
            const parsed = value === '' ? null : Number(value);
            if (value === '' || (!isNaN(parsed) && parsed !== null && parsed >= 0)) {
              onSetZoomRange(userParameters.minFrequencyHz, parsed);
            }
          }}
          style={{ width: 80 }}
        />
        {fftParamsDiffer && (
          <Tooltip label="FFT size changed - will recalculate on next analysis" withArrow>
            <Group gap={4} style={{ cursor: 'help' }}>
              <IconRefresh size={14} color="var(--mantine-color-teal-6)" />
              <Text size="xs" c="teal">Will recalculate</Text>
            </Group>
          </Tooltip>
        )}
      </div>

      {/* Progressive empty states */}
      {!hasSelection && !error && (
        <div className={styles.guidanceState}>
          <Stack align="center" gap="xs">
            <IconCursorText size={32} color="var(--mantine-color-gray-5)" />
            <Text size="sm" fw={500} c="dimmed">Select a region to analyze</Text>
            <Text size="xs" c="dimmed" ta="center">
              Click and drag on the waveform to select a time region. The spectrum will analyze the audio within that region.
            </Text>
          </Stack>
        </div>
      )}

      {hasSelection && status === 'running' && (
        <div className={styles.guidanceState}>
          <Stack align="center" gap="xs">
            <Loader size="sm" color="teal" />
            <Text size="sm" fw={500} c="dimmed">Calculating spectrum…</Text>
            <Text size="xs" c="dimmed" ta="center">
              FFT analysis in progress for selected region
            </Text>
          </Stack>
        </div>
      )}

      {hasSelection && status === 'idle' && !result?.channels.length && !error && (
        <div className={styles.guidanceState}>
          <Stack align="center" gap="xs">
            <IconChartLine size={32} color="var(--mantine-color-gray-5)" />
            <Text size="sm" fw={500} c="dimmed">Ready to analyze</Text>
            <Text size="xs" c="dimmed" ta="center">
              Region selected: {activeSelection?.startSeconds.toFixed(2)}s – {activeSelection?.endSeconds.toFixed(2)}s
            </Text>
          </Stack>
        </div>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs" m="xs">
          <Text size="xs">{error}</Text>
        </Alert>
      )}

      {/* Result */}
      {result && result.channels.length > 0 && (
        <>
          {/* Parameter summary */}
          <div className={styles.paramGrid}>
            {result && (
              <>
                <ParamRow
                  label="Region"
                  value={`${result.parameters.startTimeSeconds.toFixed(3)} – ${result.parameters.endTimeSeconds.toFixed(3)} s`}
                  tooltip="Time range of the analyzed audio segment"
                />
                <ParamRow
                  label="Duration"
                  value={`${result.region.durationSeconds.toFixed(3)} s`}
                  tooltip="Length of the selected region"
                />
                <ParamRow
                  label="FFT size"
                  value={String(result.parameters.fftSize)}
                  tooltip="Number of samples per FFT block. Larger = better frequency resolution but poorer time resolution"
                />
                <ParamRow
                  label="Window"
                  value={result.parameters.windowType}
                  tooltip="Window function applied to reduce spectral leakage. Hann is smooth and commonly used"
                />
                <ParamRow
                  label="Overlap"
                  value={`${(result.parameters.overlap * 100).toFixed(0)}%`}
                  tooltip="Percentage of each block that overlaps with the next. Higher overlap = smoother averaging"
                />
                <ParamRow
                  label="Averaging"
                  value={result.parameters.averaging}
                  tooltip="Method for combining multiple FFT blocks. Power averaging is standard for noise"
                />
                <ParamRow
                  label="Scaling"
                  value={result.parameters.scaling}
                  tooltip="One-sided spectrum shows only positive frequencies (0 to Nyquist)"
                />
                {binSpacingHz && (
                  <ParamRow
                    label="Bin spacing"
                    value={`${binSpacingHz} Hz`}
                    tooltip="Frequency resolution: distance between adjacent FFT bins"
                  />
                )}
                <ParamRow
                  label="Blocks"
                  value={String(result.parameters.blockCount)}
                  tooltip="Number of FFT blocks averaged together for the final spectrum"
                />
                {result.channels[0]?.dbReferenceValue && (
                  <ParamRow
                    label="Reference"
                    value={`${result.channels[0].dbReferenceValue} ${result.channels[0].dbReferenceUnit ?? ''}`}
                    tooltip="Calibration reference for converting to absolute units"
                  />
                )}
                {result.channels[0]?.yAxisLabel && (
                  <ParamRow
                    label="Y-axis"
                    value={result.channels[0].yAxisLabel}
                    tooltip="Unit convention for spectrum level display"
                  />
                )}
                {result.channels[0]?.physicalQuantity && (
                  <ParamRow
                    label="Quantity"
                    value={result.channels[0].physicalQuantity}
                    tooltip="Physical quantity represented by this signal"
                  />
                )}
                {result.channels[0]?.calibrationState === 'digital_full_scale' && (
                  <Alert
                    icon={<IconAlertTriangle size={14} />}
                    color="yellow"
                    variant="light"
                    p="xs"
                    mt="xs"
                    title="dB SPL unavailable"
                  >
                    <Text size="xs">
                      This file does not contain calibration information. Showing relative level [dBFS]. Provide a calibration factor to display dB SPL.
                    </Text>
                  </Alert>
                )}
              </>
            )}
          </div>

          {tonalPeaks.length > 0 && (
            <div className={styles.tonalPeakSection}>
              <div className={styles.sectionLabel}>Tonal peaks</div>
              {tonalPeaks.map((peak) => (
                <div
                  key={`${peak.channelName}-${peak.frequencyHz}-${peak.prominenceDb}`}
                  className={styles.tonalPeakRow}
                >
                  <div className={styles.tonalPeakMain}>
                    <span className={styles.tonalPeakFrequency}>{formatFrequency(peak.frequencyHz)}</span>
                    <span className={styles.tonalPeakChannel}>{peak.channelName}</span>
                  </div>
                  <div className={styles.tonalPeakMeta}>
                    <span>{peak.prominenceDb.toFixed(1)} dB prominence</span>
                    <span>{peak.localFloorDb.toFixed(1)} dB floor</span>
                    <span className={peak.confidence === 'high' ? styles.confidenceHigh : styles.confidenceMedium}>
                      {peak.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Canvas - only shown when not in sidebar mode */}
          {showCanvas && result.channels.length > 0 && (
            <div className={styles.canvasWrapper}>
              <SpectrumCanvas
                channels={result.channels.map((ch) => ({
                  channelId: ch.channelId,
                  channelName: ch.channelName,
                  points: ch.points,
                  yUnit: ch.yUnit,
                  yAxisLabel: ch.yAxisLabel,
                }))}
                minFrequencyHz={userParameters.minFrequencyHz}
                maxFrequencyHz={userParameters.maxFrequencyHz}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  }
  return `${frequencyHz.toFixed(1)} Hz`;
}

function ParamRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }): JSX.Element {
  const labelContent = (
    <span className={styles.paramLabel}>
      {label}
      {tooltip && (
        <IconInfoCircle size={10} style={{ marginLeft: 4, opacity: 0.5, verticalAlign: 'middle' }} />
      )}
    </span>
  );

  return (
    <div className={styles.paramRow}>
      {tooltip ? (
        <Tooltip label={tooltip} position="left" withArrow multiline>
          {labelContent}
        </Tooltip>
      ) : (
        labelContent
      )}
      <span className={styles.paramValue}>{value}</span>
    </div>
  );
}
