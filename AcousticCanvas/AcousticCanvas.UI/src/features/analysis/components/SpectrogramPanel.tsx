import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Badge, Alert, Tooltip } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChevronDown, IconChevronRight, IconX, IconWaveSine, IconAlertTriangle, IconSettings, IconInfoCircle } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { useRunSpectrogram } from '../hooks/useRunSpectrogram';
import {
  spectrogramResultSelector,
  spectrogramStatusSelector,
  spectrogramErrorSelector,
  spectrogramUserParametersSelector,
  spectrogramSetParameters,
  spectrogramClear,
} from '../store/spectrogramSlice';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector, cursorTimeHovered, cursorTimeCleared, cursorTimeSecondsSelector } from '../store/analysisCursorSlice';
import {
  SPECTROGRAM_FFT_SIZE_OPTIONS,
  SPECTROGRAM_GAIN_OPTIONS,
  SPECTROGRAM_RANGE_OPTIONS,
  SPECTROGRAM_SCALE_OPTIONS,
} from '../types/spectrogramTypes';
import type { SpectrogramScale } from '../types/spectrogramTypes';
import { SpectrogramPlot, SPECTROGRAM_TIME_AXIS_HEIGHT } from './SpectrogramPlot';
import type { SpectrogramPlotCursor } from './SpectrogramPlot';
import styles from './SpectrogramPanel.module.scss';

const DEFAULT_CANVAS_HEIGHT = 200;
const MIN_CANVAS_HEIGHT = 140;
const MAX_CANVAS_HEIGHT = 420;

interface ISpectrogramPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string; durationSeconds: number }>;
  selectedFileId: string | null;
  currentTimeSeconds: number;
  onSeek: (timeSeconds: number) => void;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
  isWide: boolean;
  onToggleSpan: (panelId: string) => void;
}

export const SpectrogramPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  currentTimeSeconds,
  onSeek,
  onFileSelect,
  onClose,
  isWide,
  onToggleSpan,
}: ISpectrogramPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const spectrogramResult = useAppSelector(spectrogramResultSelector);
  const spectrogramStatus = useAppSelector(spectrogramStatusSelector);
  const spectrogramError = useAppSelector(spectrogramErrorSelector);
  const spectrogramUserParameters = useAppSelector(spectrogramUserParametersSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const linkedFrequencyHz = useAppSelector(cursorFrequencyHzSelector);
  const linkedTimeSeconds = useAppSelector(cursorTimeSecondsSelector);
  const { runSpectrogram } = useRunSpectrogram();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
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
    dispatch(spectrogramClear());
  }, [effectiveFileId, dispatch]);

  // Auto-run when file or selection changes, but only if panel is expanded.
  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrogram({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: spectrogramUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, spectrogramUserParameters, runSpectrogram, isCollapsed]);

  // Refetch when panel expands if no result exists.
  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    if (isCollapsed) return;
    if (spectrogramResult) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrogram({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: spectrogramUserParameters,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, spectrogramUserParameters, runSpectrogram, spectrogramResult, isCollapsed]);

  // Clear data when panel collapses to free memory.
  useEffect(() => {
    if (isCollapsed) {
      dispatch(spectrogramClear());
    }
  }, [isCollapsed, dispatch]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrogramStatus === 'running';
  const handleSpectrogramCursorChange = (position: SpectrogramPlotCursor): void => {
    dispatch(cursorFrequencyHovered(position.frequencyHz));
    dispatch(cursorTimeHovered(position.timeSeconds));
  };

  const handleSpectrogramCursorLeave = (): void => {
    dispatch(cursorFrequencyCleared());
    dispatch(cursorTimeCleared());
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const startY = event.clientY;
    const startHeight = canvasHeight;
    const handlePointerMove = (pointerEvent: PointerEvent): void => {
      setCanvasHeight(Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, startHeight + pointerEvent.clientY - startY)));
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
          <IconWaveSine size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Spectrogram
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
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand spectrogram panel' : 'Collapse spectrogram panel'}>
            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onClose(panelId)} aria-label="Close spectrogram panel">
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </div>

      {isSettingsOpen && (
        <div className={styles.settingsDrawer}>
          <Group gap="md" p="sm">
            <div>
              <Tooltip label="Mel: perceptually uniform — matches how humans hear pitch. Log: useful for wide-range signals. Linear: true Hz axis, good for precise frequency measurement." multiline w={250} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Scale</Text>
              </Tooltip>
              <Select
                size="xs"
                data={SPECTROGRAM_SCALE_OPTIONS}
                value={spectrogramUserParameters.scale}
                onChange={(value) => value && dispatch(spectrogramSetParameters({ scale: value as SpectrogramScale }))}
                aria-label="Spectrogram frequency scale"
                style={{ width: 120 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Number of FFT lines (frequency bins). More lines = sharper frequency resolution but coarser time resolution. 1024–4096 lines suits most audio." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>FFT Size</Text>
              </Tooltip>
              <Select
                size="xs"
                data={SPECTROGRAM_FFT_SIZE_OPTIONS}
                value={String(spectrogramUserParameters.fftSize)}
                onChange={(value) => value && dispatch(spectrogramSetParameters({ fftSize: Number(value) }))}
                aria-label="FFT lines (frequency resolution)"
                title="FFT lines — higher = more frequency resolution, lower = more time resolution"
                style={{ width: 120 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Dynamic range displayed on the colour scale. Narrower range (60 dB) shows fine detail in quiet signals; wider range (100 dB) reveals very quiet content." multiline w={250} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Range (dB)</Text>
              </Tooltip>
              <Select
                size="xs"
                data={SPECTROGRAM_RANGE_OPTIONS}
                value={String(spectrogramUserParameters.rangeDb)}
                onChange={(value) => value && dispatch(spectrogramSetParameters({ rangeDb: Number(value) }))}
                aria-label="Spectrogram dynamic range"
                style={{ width: 100 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
            <div>
              <Tooltip label="Shifts the entire colour scale up or down. Increase to reveal quiet detail; decrease if the image is oversaturated (too much red/yellow)." multiline w={240} withArrow position="top">
                <Text size="xs" c="dimmed" mb={4} style={{ cursor: 'help', display: 'inline-block' }}>Gain (dB)</Text>
              </Tooltip>
              <Select
                size="xs"
                data={SPECTROGRAM_GAIN_OPTIONS}
                value={String(spectrogramUserParameters.gainDb)}
                onChange={(value) => value && dispatch(spectrogramSetParameters({ gainDb: Number(value) }))}
                aria-label="Spectrogram gain"
                style={{ width: 100 }}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
                comboboxProps={{ withinPortal: true }}
              />
            </div>
          </Group>
        </div>
      )}

      <div className={styles.panelBody} style={{ display: isCollapsed ? 'none' : undefined }}>
        {!effectiveFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run spectrogram</Text>
          </div>
        )}
        {effectiveFileId && spectrogramStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{spectrogramError ?? 'Analysis failed'}</Text>
          </div>
        )}
        {/* Calibration state warnings */}
        {spectrogramResult && spectrogramResult.channels[0]?.calibrationState === 'digital_full_scale' && (
          <Alert
            icon={<IconAlertTriangle size={14} />}
            color="yellow"
            variant="light"
            p="xs"
            m="xs"
            title="dB SPL unavailable"
          >
            <Text size="xs">
              This file does not contain calibration information. The spectrogram shows relative amplitude [dBFS]. To display sound pressure level, provide a calibration factor.
            </Text>
          </Alert>
        )}

        {effectiveFileId && spectrogramStatus !== 'error' && spectrogramResult && (
          <SpectrogramPlot
            result={spectrogramResult}
            height={canvasHeight}
            currentTimeSeconds={currentTimeSeconds}
            linkedFrequencyHz={linkedFrequencyHz}
            linkedTimeSeconds={linkedTimeSeconds}
            isLoading={isRunning}
            onSeek={onSeek}
            onCursorChange={handleSpectrogramCursorChange}
            onCursorLeave={handleSpectrogramCursorLeave}
          />
        )}
        {effectiveFileId && spectrogramStatus !== 'error' && !spectrogramResult && (
          <div className={styles.spectrogramFrame} style={{ height: canvasHeight + SPECTROGRAM_TIME_AXIS_HEIGHT }}>
            <div className={styles.emptyState}>
              {isRunning ? (
                <>
                  <Loader size="sm" color="orange" />
                  <Text size="sm" c="dimmed">Updating spectrogram</Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">Spectrogram will appear after analysis runs.</Text>
              )}
            </div>
          </div>
        )}
        {effectiveFileId && spectrogramStatus !== 'error' && (
          <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
        )}
        {spectrogramResult && (
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
        {spectrogramResult && !isInfoCollapsed && (
          <div className={styles.summary}>
            <span>
              Scale <span className={styles.summaryValue}>{spectrogramResult.parameters.scale}</span>
            </span>
            <span>
              FFT <span className={styles.summaryValue}>{spectrogramResult.parameters.fftSize}</span>
            </span>
            <span>
              Gain <span className={styles.summaryValue}>{spectrogramResult.parameters.gainDb > 0 ? '+' : ''}{spectrogramResult.parameters.gainDb} dB</span>
            </span>
            <span>
              Range <span className={styles.summaryValue}>{spectrogramResult.parameters.rangeDb} dB</span>
            </span>
            <span>
              Region <span className={styles.summaryValue}>{spectrogramResult.region.startSeconds.toFixed(2)}s – {spectrogramResult.region.endSeconds.toFixed(2)}s</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
