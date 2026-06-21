import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Group, Loader, Select, Text, Tooltip } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChartBar, IconChevronDown, IconChevronRight, IconInfoCircle, IconSettings, IconX } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector } from '../store/analysisCursorSlice';
import {
  cpbErrorSelector,
  cpbResultSelector,
  cpbSelectedChannelIdSelector,
  cpbSetChannel,
  cpbSetParameters,
  cpbStatusSelector,
  cpbUserParametersSelector,
  cpbClear,
} from '../store/cpbSlice';
import { useRunCpb } from '../hooks/useRunCpb';
import { CpbCanvas } from './CpbCanvas';
import {
  CPB_BAND_MODE_OPTIONS,
  CPB_FFT_SIZE_OPTIONS,
  CPB_METHOD_OPTIONS,
  CPB_WEIGHTING_OPTIONS,
  type ChannelCpbAnalysis,
  type CpbBandMode,
  type CpbMethod,
  type CpbWeighting,
} from '../types/cpbTypes';
import styles from './CpbPanel.module.scss';

interface ICpbPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string; durationSeconds: number }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
  isWide: boolean;
  onToggleSpan: (panelId: string) => void;
}

export const CpbPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
  isWide,
  onToggleSpan,
}: ICpbPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const activeSelection = useAppSelector(activeSelectionSelector);
  const cpbResult = useAppSelector(cpbResultSelector);
  const cpbStatus = useAppSelector(cpbStatusSelector);
  const cpbError = useAppSelector(cpbErrorSelector);
  const cpbUserParameters = useAppSelector(cpbUserParametersSelector);
  const selectedChannelId = useAppSelector(cpbSelectedChannelIdSelector);
  const linkedFrequencyHz = useAppSelector(cursorFrequencyHzSelector);
  const { runCpb } = useRunCpb();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    dispatch(cpbClear());
  }, [effectiveFileId, dispatch]);

  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    const timeoutId = window.setTimeout(() => {
      runCpb({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: cpbUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, cpbUserParameters, runCpb, isCollapsed]);

  // Refetch when panel expands if no result exists.
  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    if (cpbResult) return;
    const timeoutId = window.setTimeout(() => {
      runCpb({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: cpbUserParameters,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, cpbUserParameters, runCpb, cpbResult, isCollapsed]);

  // Clear data when panel collapses to free memory.
  useEffect(() => {
    if (isCollapsed) {
      dispatch(cpbClear());
    }
  }, [isCollapsed, dispatch]);

  const fileSelectOptions = availableFiles.map((file) => ({ value: file.id, label: file.name }));
  const selectedChannel = resolveSelectedChannel(cpbResult?.channels ?? [], selectedChannelId);
  const bandLevels = selectedChannel?.bands
    .map((band) => band.levelDb)
    .filter((value): value is number => value !== null) ?? [];
  const maxLevel = bandLevels.length > 0 ? Math.max(...bandLevels) : 0;
  const minLevel = bandLevels.length > 0 ? Math.min(...bandLevels) : -100;
  const floorLevel = Math.floor((minLevel - 6) / 10) * 10;
  const ceilingLevel = Math.ceil((maxLevel + 3) / 10) * 10;
  const topBand = selectedChannel?.bands
    .filter((band) => band.levelDb !== null)
    .sort((a, b) => (b.levelDb as number) - (a.levelDb as number))[0];
  const isRunning = cpbStatus === 'running';
  const weightingLabel = cpbResult?.parameters.weighting?.toUpperCase() ?? 'Z';
  const weightingMethod = cpbResult?.parameters.weightingMethod ?? 'Z-weighting unweighted flat response';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 120 }}>
          <IconChartBar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            CPB
          </Text>
          {availableFiles.length > 1 ? (
            <Select
              size="xs"
              placeholder="Select file..."
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
              : 'Full file'}
          </Badge>
          {isRunning && <Loader size="xs" color="teal" />}
        </Group>
        <Group gap={2}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsSettingsOpen((value) => !value)} aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}>
            <IconSettings size={13} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onToggleSpan(panelId)} aria-label={isWide ? 'Restore panel width' : 'Widen panel to full width'}>
            {isWide ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={13} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand CPB panel' : 'Collapse CPB panel'}>
            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onClose(panelId)} aria-label="Close CPB panel">
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </div>

      {isSettingsOpen && (
        <div className={styles.settingsDrawer}>
          <Group gap="md" p="sm">
            <div>
              <Tooltip label="1/1 octave: broad bands for overview. 1/3 octave: standard for detailed frequency analysis per ISO 266." multiline w={220} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Band Mode</Text>
              </Tooltip>
              <Select
                size="xs"
                data={CPB_BAND_MODE_OPTIONS}
                value={cpbUserParameters.bandMode}
                onChange={(value) => value && dispatch(cpbSetParameters({ bandMode: value as CpbBandMode }))}
                aria-label="CPB band mode"
                style={{ width: 120 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Z: flat (unweighted). A: mimics human hearing sensitivity — attenuates low/high freqs. C: similar to A but retains more low-frequency content." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Weighting</Text>
              </Tooltip>
              <Select
                size="xs"
                data={CPB_WEIGHTING_OPTIONS}
                value={cpbUserParameters.weighting}
                onChange={(value) => value && dispatch(cpbSetParameters({ weighting: value as CpbWeighting }))}
                aria-label="CPB weighting"
                style={{ width: 80 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="FFT: fast, good for stationary signals. Filter: more accurate for transients; matches analog octave filter banks per IEC 61260." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Method</Text>
              </Tooltip>
              <Select
                size="xs"
                data={CPB_METHOD_OPTIONS}
                value={cpbUserParameters.method}
                onChange={(value) => value && dispatch(cpbSetParameters({ method: value as CpbMethod }))}
                aria-label="CPB method"
                style={{ width: 100 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Larger FFT = finer frequency resolution but slower. Used only with FFT method. 4096–16384 is a good balance for most signals." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>FFT Size</Text>
              </Tooltip>
              <Select
                size="xs"
                data={CPB_FFT_SIZE_OPTIONS}
                value={String(cpbUserParameters.fftSize)}
                onChange={(value) => value && dispatch(cpbSetParameters({ fftSize: Number(value) }))}
                aria-label="CPB FFT size"
                style={{ width: 100 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            {cpbResult && cpbResult.channels.length > 1 && (
              <div>
                <Text size="xs" c="dimmed" mb={4}>Channel</Text>
                <Select
                  size="xs"
                  data={cpbResult.channels.map((channel) => ({ value: channel.channelId, label: channel.channelName }))}
                  value={selectedChannel?.channelId ?? null}
                  onChange={(value) => value && dispatch(cpbSetChannel(value))}
                  aria-label="CPB channel"
                  style={{ width: 120 }}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                  comboboxProps={{ withinPortal: true }}
                />
              </div>
            )}
          </Group>
        </div>
      )}

      <div className={styles.panelBody} style={{ display: isCollapsed ? 'none' : undefined }}>
        {!effectiveFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run CPB</Text>
          </div>
        )}
        {effectiveFileId && cpbStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{cpbError ?? 'CPB analysis failed'}</Text>
          </div>
        )}
        {effectiveFileId && cpbStatus !== 'error' && selectedChannel && (
          <>
            <div className={styles.chartWrap}>
              <div className={styles.chart}>
                <CpbCanvas
                  bands={selectedChannel.bands}
                  dbUnit={selectedChannel.dbUnit}
                  linkedFrequencyHz={linkedFrequencyHz}
                  onHoverFrequency={(frequencyHz) =>
                    dispatch(frequencyHz === null
                      ? cursorFrequencyCleared()
                      : cursorFrequencyHovered(frequencyHz))
                  }
                />
              </div>
              {isRunning && (
                <div className={styles.loadingOverlay}>
                  <Loader size="sm" color="teal" />
                  <span>Updating CPB</span>
                </div>
              )}
            </div>
            <div className={styles.summaryHeader}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setIsSummaryCollapsed((value) => !value)}
                aria-label={isSummaryCollapsed ? 'Show analysis details' : 'Hide analysis details'}
              >
                <IconInfoCircle size={13} />
              </ActionIcon>
            </div>
            {!isSummaryCollapsed && (
              <div className={styles.summary}>
                <span>
                  Range <span className={styles.summaryValue}>{floorLevel} to {ceilingLevel} {selectedChannel.dbUnit ?? 'dB'}</span>
                </span>
                <span>
                  Bands <span className={styles.summaryValue}>{selectedChannel.bands.length}</span>
                </span>
                {topBand && (
                  <span>
                    Max <span className={styles.summaryValue}>{topBand.label} Hz / {(topBand.levelDb as number).toFixed(1)} {selectedChannel.dbUnit ?? 'dB'}</span>
                  </span>
                )}
                <span>
                  Method <span className={styles.summaryValue}>{cpbResult?.parameters.method}</span>
                </span>
                <span>
                  Weighting <span className={styles.summaryValue}>{weightingLabel} ({weightingMethod})</span>
                </span>
                {cpbResult?.parameters.limitations?.[0] && (
                  <span>
                    Note <span className={styles.summaryValue}>{cpbResult.parameters.limitations[0]}</span>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function resolveSelectedChannel(channels: ChannelCpbAnalysis[], selectedChannelId: string | null): ChannelCpbAnalysis | null {
  return channels.find((channel) => channel.channelId === selectedChannelId) ?? channels[0] ?? null;
}
