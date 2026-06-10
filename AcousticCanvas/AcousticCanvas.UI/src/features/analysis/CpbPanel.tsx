import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Group, Loader, Select, Text, Tooltip } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChartBar, IconChevronDown, IconChevronRight, IconX } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../store/reduxHooks';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector } from './analysisCursorSlice';
import {
  cpbErrorSelector,
  cpbResultSelector,
  cpbSelectedChannelIdSelector,
  cpbSetChannel,
  cpbSetParameters,
  cpbStatusSelector,
  cpbUserParametersSelector,
} from './cpbSlice';
import { useRunCpb } from './useRunCpb';
import {
  CPB_BAND_MODE_OPTIONS,
  CPB_FFT_SIZE_OPTIONS,
  CPB_METHOD_OPTIONS,
  CPB_WEIGHTING_OPTIONS,
  type ChannelCpbAnalysis,
  type CpbBandMode,
  type CpbMethod,
  type CpbWeighting,
} from './cpbTypes';
import styles from './CpbPanel.module.scss';

interface CpbPanelProps {
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
}: CpbPanelProps): JSX.Element => {
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

  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    const timeoutId = window.setTimeout(() => {
      runCpb({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: cpbUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, cpbUserParameters, runCpb]);

  const fileSelectOptions = availableFiles.map((file) => ({ value: file.id, label: file.name }));
  const selectedChannel = resolveSelectedChannel(cpbResult?.channels ?? [], selectedChannelId);
  const bandLevels = selectedChannel?.bands
    .map((band) => band.levelDb ?? (band.magnitude > 0 ? 20 * Math.log10(band.magnitude) : null))
    .filter((value): value is number => value !== null) ?? [];
  const maxLevel = bandLevels.length > 0 ? Math.max(...bandLevels) : 0;
  const minLevel = bandLevels.length > 0 ? Math.min(...bandLevels) : -100;
  const floorLevel = Math.floor((minLevel - 6) / 10) * 10;
  const ceilingLevel = Math.ceil((maxLevel + 3) / 10) * 10;
  const topBand = selectedChannel?.bands
    .filter((band) => band.levelDb !== null || band.magnitude > 0)
    .sort((a, b) => resolveBandLevel(b) - resolveBandLevel(a))[0];
  const isRunning = cpbStatus === 'running';
  const weightingLabel = cpbResult?.parameters.weighting?.toUpperCase() ?? 'Z';
  const weightingMethod = cpbResult?.parameters.weightingMethod ?? 'Z-weighting unweighted flat response';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
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
          <Select
            size="xs"
            data={CPB_BAND_MODE_OPTIONS}
            value={cpbUserParameters.bandMode}
            onChange={(value) => value && dispatch(cpbSetParameters({ bandMode: value as CpbBandMode }))}
            aria-label="CPB band mode"
            style={{ width: 92 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={CPB_WEIGHTING_OPTIONS}
            value={cpbUserParameters.weighting}
            onChange={(value) => value && dispatch(cpbSetParameters({ weighting: value as CpbWeighting }))}
            aria-label="CPB weighting"
            style={{ width: 64 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={CPB_METHOD_OPTIONS}
            value={cpbUserParameters.method}
            onChange={(value) => value && dispatch(cpbSetParameters({ method: value as CpbMethod }))}
            aria-label="CPB method"
            style={{ width: 76 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={CPB_FFT_SIZE_OPTIONS}
            value={String(cpbUserParameters.fftSize)}
            onChange={(value) => value && dispatch(cpbSetParameters({ fftSize: Number(value) }))}
            aria-label="CPB FFT size"
            style={{ width: 82 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          {cpbResult && cpbResult.channels.length > 1 && (
            <Select
              size="xs"
              data={cpbResult.channels.map((channel) => ({ value: channel.channelId, label: channel.channelName }))}
              value={selectedChannel?.channelId ?? null}
              onChange={(value) => value && dispatch(cpbSetChannel(value))}
              aria-label="CPB channel"
              style={{ width: 96 }}
              styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
            />
          )}
          {isRunning && <Loader size="xs" color="teal" />}
        </Group>
        <Group gap={2}>
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
              <div className={styles.chart} onMouseLeave={() => dispatch(cursorFrequencyCleared())}>
                {selectedChannel.bands.map((band) => {
                  const level = resolveBandLevel(band);
                  const percent = ceilingLevel > floorLevel
                    ? Math.max(0, Math.min(100, (level - floorLevel) / (ceilingLevel - floorLevel) * 100))
                    : 0;
                  const isLinked = linkedFrequencyHz !== null
                    && linkedFrequencyHz >= band.lowerFrequencyHz
                    && linkedFrequencyHz < band.upperFrequencyHz;
                  return (
                    <Tooltip
                      key={band.label}
                      label={`${band.label} Hz: ${level.toFixed(1)} ${selectedChannel.dbUnit ?? 'dB'} (${band.lowerFrequencyHz.toFixed(1)}-${band.upperFrequencyHz.toFixed(1)} Hz)`}
                      withArrow
                    >
                      <div
                        className={isLinked ? `${styles.barColumn} ${styles.barColumnLinked}` : styles.barColumn}
                        onMouseEnter={() => dispatch(cursorFrequencyHovered(band.centerFrequencyHz))}
                      >
                        <div className={styles.barTrack}>
                          <div className={styles.barFill} style={{ height: `${percent}%` }} />
                        </div>
                        <span className={styles.barLabel}>{band.label}</span>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
              {isRunning && (
                <div className={styles.loadingOverlay}>
                  <Loader size="sm" color="teal" />
                  <span>Updating CPB</span>
                </div>
              )}
            </div>
            <div className={styles.summary}>
              <span>
                Range <span className={styles.summaryValue}>{floorLevel} to {ceilingLevel} {selectedChannel.dbUnit ?? 'dB'}</span>
              </span>
              <span>
                Bands <span className={styles.summaryValue}>{selectedChannel.bands.length}</span>
              </span>
              {topBand && (
                <span>
                  Max <span className={styles.summaryValue}>{topBand.label} Hz / {resolveBandLevel(topBand).toFixed(1)} {selectedChannel.dbUnit ?? 'dB'}</span>
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
          </>
        )}
      </div>
    </div>
  );
};

function resolveSelectedChannel(channels: ChannelCpbAnalysis[], selectedChannelId: string | null): ChannelCpbAnalysis | null {
  return channels.find((channel) => channel.channelId === selectedChannelId) ?? channels[0] ?? null;
}

function resolveBandLevel(band: { levelDb: number | null; magnitude: number }): number {
  if (band.levelDb !== null) {
    return band.levelDb;
  }
  return band.magnitude > 0 ? 20 * Math.log10(band.magnitude) : -140;
}
