import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Box, Checkbox, Badge, TextInput, Tooltip } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChevronDown, IconChevronRight, IconX, IconChartLine, IconSettings, IconInfoCircle } from '@tabler/icons-react';
import { useAppSelector, useAppDispatch } from '../../../store/reduxHooks';
import { useRunSpectrum } from '../hooks/useRunSpectrum';
import {
  spectrumResultSelector,
  spectrumStatusSelector,
  spectrumErrorSelector,
  spectrumUserParametersSelector,
  spectrumSetZoomRange,
  spectrumSetParameters,
  spectrumClear,
} from '../store/spectrumSlice';
import { FFT_SIZE_OPTIONS } from '../types/spectrumTypes';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector } from '../store/analysisCursorSlice';
import { SpectrumCanvas } from './SpectrumCanvas';
import { agentPromptPrefillSet, setActiveMode } from '../../navigation/store/navigationSlice';
import styles from './SpectrogramPanel.module.scss';

interface ISpectrumPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
  isWide: boolean;
  onToggleSpan: (panelId: string) => void;
}

export const SpectrumPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
  isWide,
  onToggleSpan,
}: ISpectrumPanelProps): JSX.Element => {
  const spectrumResult = useAppSelector(spectrumResultSelector);
  const spectrumStatus = useAppSelector(spectrumStatusSelector);
  const spectrumError = useAppSelector(spectrumErrorSelector);
  const spectrumUserParameters = useAppSelector(spectrumUserParametersSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const linkedFrequencyHz = useAppSelector(cursorFrequencyHzSelector);
  const { runSpectrum } = useRunSpectrum();
  const dispatch = useAppDispatch();

  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);
  const [panelHeight, setPanelHeight] = useState(200);
  const effectiveFileId = selectedFileId ?? availableFiles[0]?.id ?? null;
  const selectedFile = availableFiles.find((file) => file.id === effectiveFileId);
  const hasRegion = Boolean(activeSelection && activeSelection.endSeconds > activeSelection.startSeconds);
  const regionStartSeconds = activeSelection?.startSeconds;
  const regionEndSeconds = activeSelection?.endSeconds;

  useEffect(() => {
    if (!selectedFileId && effectiveFileId) {
      onFileSelect(panelId, effectiveFileId);
    }
  }, [effectiveFileId, onFileSelect, panelId, selectedFileId]);

  // Clear data when file changes to prevent showing stale data from previous file.
  useEffect(() => {
    dispatch(spectrumClear());
  }, [effectiveFileId, dispatch]);

  const toggleChannel = (channelId: string): void => {
    setHiddenChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const handleSetZoomRange = (minFrequencyHz: number | null, maxFrequencyHz: number | null): void => {
    dispatch(spectrumSetZoomRange({ minFrequencyHz, maxFrequencyHz }));
  };

  // Auto-run when file or selection changes, but only if panel is expanded.
  useEffect(() => {
    if (!effectiveFileId || !hasRegion) return;
    if (isCollapsed) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrum({
        fileId: effectiveFileId,
        startSeconds: regionStartSeconds!,
        endSeconds: regionEndSeconds!,
        parameters: spectrumUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, hasRegion, regionStartSeconds, regionEndSeconds, spectrumUserParameters, runSpectrum, isCollapsed]);

  // Refetch when panel expands if no result exists.
  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    if (spectrumResult) return;
    if (!hasRegion) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrum({
        fileId: effectiveFileId,
        startSeconds: regionStartSeconds!,
        endSeconds: regionEndSeconds!,
        parameters: spectrumUserParameters,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, spectrumUserParameters, runSpectrum, spectrumResult, isCollapsed]);

  // Clear data when panel collapses to free memory.
  useEffect(() => {
    if (isCollapsed) {
      dispatch(spectrumClear());
    }
  }, [isCollapsed, dispatch]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrumStatus === 'running';

  const visibleChannels = spectrumResult && hasRegion
    ? spectrumResult.channels
        .map((ch, originalIndex) => ({
          channelId: ch.channelId,
          channelName: ch.channelName,
          points: ch.points,
          yUnit: ch.yUnit,
          yAxisLabel: ch.yAxisLabel,
          originalIndex,
        }))
        .filter((ch) => !hiddenChannelIds.has(ch.channelId))
    : [];

  const hasMultipleChannels = spectrumResult && spectrumResult.channels.length > 1;
  const peakSummaryFrequencyHz = spectrumResult?.channels?.[0]?.peakFrequencyHz ?? null;
  const peakSummaryMagnitudeDb = spectrumResult?.channels?.[0]?.maxMagnitudeDb ?? null;
  const peakSummaryUnit = spectrumResult?.channels?.[0]?.yUnit ?? 'dB';

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const startY = event.clientY;
    const startHeight = panelHeight;
    const handlePointerMove = (pointerEvent: PointerEvent): void => {
      setPanelHeight(Math.max(140, Math.min(420, startHeight + pointerEvent.clientY - startY)));
    };
    const handlePointerUp = (): void => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 120 }}>
          <IconChartLine size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Spectrum
          </Text>
          {availableFiles.length > 1 ? (
            <Select
              size="xs"
              placeholder="Select file…"
              data={fileSelectOptions}
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
              : 'Select region'}
          </Badge>
          {isRunning && <Loader size="xs" color="teal" />}
        </Group>
        {visibleChannels.length > 0 && (
          <button
            type="button"
            className={styles.askAgentButton}
            onClick={() => {
              dispatch(agentPromptPrefillSet('Explain the spectrum analysis for the loaded file. What are the dominant frequencies and any notable tonal peaks or spectral content of interest?'));
              dispatch(setActiveMode('agent'));
            }}
            title="Ask agent about this spectrum"
          >
            Explain this spectrum →
          </button>
        )}
        <Group gap={2} style={{ flexShrink: 0 }}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsSettingsOpen((value) => !value)} aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}>
            <IconSettings size={13} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onToggleSpan(panelId)} aria-label={isWide ? 'Restore panel width' : 'Widen panel to full width'}>
            {isWide ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={13} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand spectrum panel' : 'Collapse spectrum panel'}>
            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onClose(panelId)}
            aria-label="Close spectrum panel"
          >
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </div>

      {isSettingsOpen && (
        <div className={styles.settingsDrawer}>
          <Group gap="md" p="sm" align="flex-start">
            <div>
              <Tooltip label="Number of samples per FFT block. Larger = finer frequency resolution but coarser time resolution. 4096–16384 suits most audio." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>FFT size</Text>
              </Tooltip>
              <Select
                size="xs"
                value={String(spectrumUserParameters.fftSize)}
                data={FFT_SIZE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                onChange={(val) => val && dispatch(spectrumSetParameters({ fftSize: Number(val) }))}
                style={{ width: 90 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Hann: standard choice — minimises spectral leakage. Rectangular: no windowing, good for periodic signals that exactly fit the block length." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Window</Text>
              </Tooltip>
              <Select
                size="xs"
                value={spectrumUserParameters.windowType}
                data={[
                  { value: 'hann', label: 'Hann' },
                  { value: 'rectangular', label: 'Rectangular' },
                ]}
                onChange={(val) => val && dispatch(spectrumSetParameters({ windowType: val as 'hann' | 'rectangular' }))}
                style={{ width: 110 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Fraction of consecutive FFT blocks that overlap. Higher overlap = more blocks averaged = smoother spectrum. 50–75% is a good default." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Overlap</Text>
              </Tooltip>
              <Select
                size="xs"
                value={String(spectrumUserParameters.overlap)}
                data={[
                  { value: '0', label: '0%' },
                  { value: '0.25', label: '25%' },
                  { value: '0.5', label: '50%' },
                  { value: '0.677', label: '67.7%' },
                  { value: '0.75', label: '75%' },
                  { value: '0.9', label: '90%' },
                ]}
                onChange={(val) => val && dispatch(spectrumSetParameters({ overlap: Number(val) }))}
                style={{ width: 80 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Zoom the frequency axis: set the lower bound in Hz. Leave blank to show from DC (0 Hz)." multiline w={200} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Min Hz</Text>
              </Tooltip>
              <TextInput
                size="xs"
                placeholder="Min Hz"
                value={spectrumUserParameters.minFrequencyHz ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  const parsed = value === '' ? null : Number(value);
                  if (value === '' || (parsed !== null && !isNaN(parsed) && parsed >= 0)) {
                    handleSetZoomRange(parsed, spectrumUserParameters.maxFrequencyHz);
                  }
                }}
                style={{ width: 80 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
              />
            </div>
            <div>
              <Tooltip label="Zoom the frequency axis: set the upper bound in Hz. Leave blank to show up to Nyquist (half the sample rate)." multiline w={210} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Max Hz</Text>
              </Tooltip>
              <TextInput
                size="xs"
                placeholder="Max Hz"
                value={spectrumUserParameters.maxFrequencyHz ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  const parsed = value === '' ? null : Number(value);
                  if (value === '' || (parsed !== null && !isNaN(parsed) && parsed >= 0)) {
                    handleSetZoomRange(spectrumUserParameters.minFrequencyHz, parsed);
                  }
                }}
                style={{ width: 80 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
              />
            </div>
            {hasMultipleChannels && spectrumResult && (
              <div>
                <Text size="xs" c="dimmed" mb={4}>Channels</Text>
                <Group gap="sm">
                  {spectrumResult.channels.map((ch) => (
                    <Checkbox
                      key={ch.channelId}
                      size="xs"
                      label={ch.channelName}
                      checked={!hiddenChannelIds.has(ch.channelId)}
                      onChange={() => toggleChannel(ch.channelId)}
                    />
                  ))}
                </Group>
              </div>
            )}
          </Group>
        </div>
      )}

      {!isCollapsed && <div className={styles.panelBody}>
        {!effectiveFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run spectrum</Text>
          </div>
        )}
        {effectiveFileId && !hasRegion && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a region on the waveform</Text>
          </div>
        )}
        {effectiveFileId && spectrumStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{spectrumError ?? 'Analysis failed'}</Text>
          </div>
        )}
        {visibleChannels.length > 0 && (
          <Box style={{ height: panelHeight, padding: '8px' }}>
            <SpectrumCanvas
              channels={visibleChannels}
              linkedFrequencyHz={linkedFrequencyHz}
              onHoverFrequency={(hz) => dispatch(hz === null ? cursorFrequencyCleared() : cursorFrequencyHovered(hz))}
              minFrequencyHz={spectrumUserParameters.minFrequencyHz}
              maxFrequencyHz={spectrumUserParameters.maxFrequencyHz}
            />
          </Box>
        )}
        {peakSummaryFrequencyHz !== null && (
          <div className={styles.summaryBar}>
            <span className={styles.summaryTakeaway}>
              Peak: {peakSummaryFrequencyHz.toFixed(1)} Hz{peakSummaryMagnitudeDb !== null ? ` — ${peakSummaryMagnitudeDb.toFixed(1)} ${peakSummaryUnit}` : ''}
            </span>
          </div>
        )}
        {visibleChannels.length > 0 && (
          <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
        )}
        {visibleChannels.length > 0 && (
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
        )}
        {visibleChannels.length > 0 && !isInfoCollapsed && (
          <div className={styles.summary}>
            {spectrumResult?.channels[0]?.peakFrequencyHz != null && (
              <span>
                Peak <span className={styles.summaryValue}>{spectrumResult.channels[0].peakFrequencyHz.toFixed(1)} Hz</span>
              </span>
            )}
            {spectrumResult?.channels[0]?.maxMagnitudeDb != null && (
              <span>
                Level <span className={styles.summaryValue}>{spectrumResult.channels[0].maxMagnitudeDb.toFixed(1)} {visibleChannels[0].yUnit}</span>
              </span>
            )}
            <span>
              FFT <span className={styles.summaryValue}>{spectrumUserParameters.fftSize}</span>
            </span>
            <span>
              Window <span className={styles.summaryValue}>{spectrumUserParameters.windowType}</span>
            </span>
            <span>
              Overlap <span className={styles.summaryValue}>{Math.round(spectrumUserParameters.overlap * 100)}%</span>
            </span>
          </div>
        )}
      </div>}
    </div>
  );
};
