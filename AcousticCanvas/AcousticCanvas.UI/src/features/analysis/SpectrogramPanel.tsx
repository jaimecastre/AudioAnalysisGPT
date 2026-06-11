import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Badge, Alert } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChevronDown, IconChevronRight, IconX, IconWaveSine, IconAlertTriangle } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../store/reduxHooks';
import { useRunSpectrogram } from './useRunSpectrogram';
import {
  spectrogramResultSelector,
  spectrogramStatusSelector,
  spectrogramErrorSelector,
  spectrogramUserParametersSelector,
  spectrogramSetParameters,
} from './spectrogramSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector, cursorTimeHovered, cursorTimeCleared, cursorTimeSecondsSelector } from './analysisCursorSlice';
import {
  SPECTROGRAM_FFT_SIZE_OPTIONS,
  SPECTROGRAM_GAIN_OPTIONS,
  SPECTROGRAM_RANGE_OPTIONS,
  SPECTROGRAM_SCALE_OPTIONS,
} from './spectrogramTypes';
import type { ChannelSpectrogramAnalysis, SpectrogramAxisTick, SpectrogramScale } from './spectrogramTypes';
import styles from './SpectrogramPanel.module.scss';

const DEFAULT_CANVAS_HEIGHT = 200;
const MIN_CANVAS_HEIGHT = 140;
const MAX_CANVAS_HEIGHT = 420;
const AXIS_WIDTH = 60;
const COLORBAR_WIDTH = 85;
const TIME_AXIS_HEIGHT = 24;
const FONT = "10px 'JetBrains Mono', ui-monospace, monospace";
const LABEL_COLOR = 'rgba(0,0,0,0.45)';

// BK Connect-style colormap: black → navy → blue → magenta → red → orange → yellow → white
function buildColorTable(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  const stops = [
    { pos: 0.00, r: 0,   g: 0,   b: 0   },  // black  (below floor)
    { pos: 0.12, r: 10,  g: 0,   b: 60  },  // dark navy
    { pos: 0.23, r: 0,   g: 30,  b: 160 },  // blue
    { pos: 0.35, r: 50,  g: 40,  b: 230 },  // bright blue
    { pos: 0.46, r: 150, g: 0,   b: 230 },  // blue-magenta
    { pos: 0.55, r: 255, g: 0,   b: 210 },  // magenta
    { pos: 0.63, r: 255, g: 0,   b: 110 },  // pink-red
    { pos: 0.72, r: 255, g: 0,   b: 0   },  // red
    { pos: 0.80, r: 255, g: 90,  b: 0   },  // orange
    { pos: 0.88, r: 255, g: 210, b: 0   },  // yellow
    { pos: 0.95, r: 255, g: 250, b: 150 },  // light yellow
    { pos: 1.00, r: 255, g: 255, b: 255 },  // white (peak)
  ];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let si = 0;
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].pos) si = s;
    }
    const a = stops[si];
    const b = stops[Math.min(si + 1, stops.length - 1)];
    const span = b.pos - a.pos;
    const f = span > 0 ? (t - a.pos) / span : 0;
    table[i * 4 + 0] = Math.round(a.r + (b.r - a.r) * f);
    table[i * 4 + 1] = Math.round(a.g + (b.g - a.g) * f);
    table[i * 4 + 2] = Math.round(a.b + (b.b - a.b) * f);
    table[i * 4 + 3] = 255;
  }
  return table;
}

const COLOR_TABLE = buildColorTable();

// Draws the spectrogram frames onto a canvas.
// frequencyData contains backend byte[] frames serialized as base64 strings.
// Bins run low→high; we flip vertically so 0 Hz is at the bottom.
function drawSpectrogramToCanvas(
  canvas: HTMLCanvasElement,
  frequencyData: string[],
): void {
  const numFrames = frequencyData.length;
  const decodedFrames = frequencyData.map(decodeBase64Frame);
  const numBins = decodedFrames[0]?.length ?? 0;
  if (numFrames === 0 || numBins === 0) return;

  canvas.width = numFrames;
  canvas.height = numBins;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(numFrames, numBins);
  const pixels = imageData.data;

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frame = decodedFrames[frameIdx];
    for (let binIdx = 0; binIdx < numBins; binIdx++) {
      const value = frame[binIdx];
      // Flip vertically: bin 0 (DC/low freq) → bottom row of canvas.
      const flippedBin = numBins - 1 - binIdx;
      const pixelOffset = (flippedBin * numFrames + frameIdx) * 4;
      pixels[pixelOffset + 0] = COLOR_TABLE[value * 4 + 0];
      pixels[pixelOffset + 1] = COLOR_TABLE[value * 4 + 1];
      pixels[pixelOffset + 2] = COLOR_TABLE[value * 4 + 2];
      pixels[pixelOffset + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function decodeBase64Frame(encodedFrame: string): Uint8Array {
  const binaryFrame = window.atob(encodedFrame);
  const decodedFrame = new Uint8Array(binaryFrame.length);
  for (let index = 0; index < binaryFrame.length; index++) {
    decodedFrame[index] = binaryFrame.charCodeAt(index);
  }
  return decodedFrame;
}

// Draws backend-provided frequency axis tick labels on a separate canvas.
function drawFrequencyAxis(
  axisCanvas: HTMLCanvasElement,
  ticks: SpectrogramAxisTick[],
  height: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  axisCanvas.width = AXIS_WIDTH * dpr;
  axisCanvas.height = height * dpr;
  axisCanvas.style.width = `${AXIS_WIDTH}px`;
  axisCanvas.style.height = `${height}px`;

  const ctx = axisCanvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, AXIS_WIDTH, height);
  ctx.font = FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const TICK_LENGTH = 4;
  ctx.strokeStyle = LABEL_COLOR;
  ctx.lineWidth = 1;

  for (const tick of ticks) {
    const y = tick.positionPercent / 100 * height;
    const clampedY = Math.max(2, Math.min(y, height - 10));
    // Tick line flush against the right edge of the axis canvas.
    ctx.beginPath();
    ctx.moveTo(AXIS_WIDTH, clampedY);
    ctx.lineTo(AXIS_WIDTH - TICK_LENGTH, clampedY);
    ctx.stroke();
    ctx.fillText(tick.label, AXIS_WIDTH - TICK_LENGTH - 2, clampedY);
  }
}

// Draws a vertical colorbar showing the jet gradient with dB tick labels.
function drawColorbar(
  colorbarCanvas: HTMLCanvasElement,
  minDbSpl: number,
  maxDbSpl: number,
  height: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  colorbarCanvas.width = COLORBAR_WIDTH * dpr;
  colorbarCanvas.height = height * dpr;
  colorbarCanvas.style.width = `${COLORBAR_WIDTH}px`;
  colorbarCanvas.style.height = `${height}px`;

  const ctx = colorbarCanvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, COLORBAR_WIDTH, height);

  const BAR_X = 4;
  const BAR_W = 10;
  for (let py = 0; py < height; py++) {
    const fraction = 1 - py / Math.max(1, height - 1); // top = max, bottom = min
    const byteVal = Math.round(fraction * 255);
    const r = COLOR_TABLE[byteVal * 4 + 0];
    const g = COLOR_TABLE[byteVal * 4 + 1];
    const b = COLOR_TABLE[byteVal * 4 + 2];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(BAR_X, py, BAR_W, 1);
  }

  const TICK_X = BAR_X + BAR_W;
  const TICK_LEN = 3;
  const dbRange = maxDbSpl - minDbSpl;

  ctx.font = FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = LABEL_COLOR;
  ctx.lineWidth = 1;

  const firstTick = Math.ceil(minDbSpl / 10) * 10;
  for (let db = firstTick; db <= maxDbSpl; db += 10) {
    const fraction = (db - minDbSpl) / dbRange;
    const y = height - fraction * height;
    const cy = Math.max(5, Math.min(y, height - 5));
    ctx.beginPath();
    ctx.moveTo(TICK_X, cy);
    ctx.lineTo(TICK_X + TICK_LEN, cy);
    ctx.stroke();
    ctx.fillText(`${db}`, TICK_X + TICK_LEN + 2, cy);
  }
}

function frequencyToScale(frequencyHz: number, scale: SpectrogramScale): number {
  if (scale === 'mel') return 2595 * Math.log10(1 + frequencyHz / 700);
  if (scale === 'logarithmic') return Math.log10(1 + frequencyHz);
  return frequencyHz;
}

function scaleToFrequency(scaledFrequency: number, scale: SpectrogramScale): number {
  if (scale === 'mel') return 700 * (10 ** (scaledFrequency / 2595) - 1);
  if (scale === 'logarithmic') return 10 ** scaledFrequency - 1;
  return scaledFrequency;
}

interface SpectrogramPanelProps {
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

interface SpectrogramHover {
  xPercent: number;
  yPercent: number;
  timeSeconds: number;
  frequencyHz: number;
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
}: SpectrogramPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const spectrogramResult = useAppSelector(spectrogramResultSelector);
  const spectrogramStatus = useAppSelector(spectrogramStatusSelector);
  const spectrogramError = useAppSelector(spectrogramErrorSelector);
  const spectrogramUserParameters = useAppSelector(spectrogramUserParametersSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const linkedFrequencyHz = useAppSelector(cursorFrequencyHzSelector);
  const linkedTimeSeconds = useAppSelector(cursorTimeSecondsSelector);
  const { runSpectrogram } = useRunSpectrogram();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorbarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<SpectrogramHover | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const effectiveFileId = selectedFileId ?? availableFiles[0]?.id ?? null;
  const selectedFile = availableFiles.find((file) => file.id === effectiveFileId);
  const canvasKey = spectrogramResult
    ? `${spectrogramResult.parameters.fftSize}-${spectrogramResult.region.startSeconds}-${spectrogramResult.region.endSeconds}`
    : 'empty';
  const hasRegion = Boolean(activeSelection && activeSelection.endSeconds > activeSelection.startSeconds);
  const regionStartSeconds = activeSelection?.startSeconds;
  const regionEndSeconds = activeSelection?.endSeconds;

  useEffect(() => {
    if (!selectedFileId && effectiveFileId) {
      onFileSelect(panelId, effectiveFileId);
    }
  }, [effectiveFileId, onFileSelect, panelId, selectedFileId]);

  // Auto-run when file or selection changes.
  useEffect(() => {
    if (!effectiveFileId || !selectedFile) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrogram({
        fileId: effectiveFileId,
        startSeconds: hasRegion ? regionStartSeconds! : 0,
        endSeconds: hasRegion ? regionEndSeconds! : selectedFile.durationSeconds,
        parameters: spectrogramUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, selectedFile, hasRegion, regionStartSeconds, regionEndSeconds, spectrogramUserParameters, runSpectrogram]);

  // Paint canvas when data arrives.
  useEffect(() => {
    const canvas = canvasRef.current;
    const axisCanvas = axisCanvasRef.current;
    if (!canvas || !axisCanvas) return;
    if (!spectrogramResult || spectrogramResult.channels.length === 0) return;

    const channelData: ChannelSpectrogramAnalysis = spectrogramResult.channels[0];
    if (channelData.frequencyData.length === 0) return;

    drawSpectrogramToCanvas(canvas, channelData.frequencyData);

    drawFrequencyAxis(axisCanvas, spectrogramResult.frequencyAxisTicks ?? [], canvasHeight);

    const colorbarCanvas = colorbarCanvasRef.current;
    if (colorbarCanvas) {
      drawColorbar(
        colorbarCanvas,
        spectrogramResult.parameters.minDbSpl,
        spectrogramResult.parameters.maxDbSpl,
        canvasHeight,
      );
    }
  }, [canvasHeight, spectrogramResult]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrogramStatus === 'running';
  const renderedRegion = spectrogramResult?.region;
  const renderedScale = spectrogramResult?.parameters.scale;
  const renderedNyquistHz = spectrogramResult ? spectrogramResult.parameters.sampleRate / 2 : 0;
  const colorbandLabel = spectrogramResult?.channels[0]?.colorbandLabel;
  const playheadPercent = renderedRegion && renderedRegion.durationSeconds > 0
    ? (currentTimeSeconds - renderedRegion.startSeconds) / renderedRegion.durationSeconds * 100
    : -1;
  const showPlayhead = playheadPercent >= 0 && playheadPercent <= 100;

  // Map a frequency (Hz) to a vertical position for the cross-panel linked cursor.
  // Inverse of the hover mapping: frequencyHz = scaleToFrequency((1 - yFraction) * scaledMax).
  const linkedFrequencyPercent = (renderedScale && renderedNyquistHz > 0 && linkedFrequencyHz !== null)
    ? (1 - frequencyToScale(linkedFrequencyHz, renderedScale) / frequencyToScale(renderedNyquistHz, renderedScale)) * 100
    : -1;
  const showLinkedFrequency = !hover && linkedFrequencyPercent >= 0 && linkedFrequencyPercent <= 100;

  // Map a time (s) to a horizontal position for the cross-panel linked time cursor.
  const linkedTimePercent = (renderedRegion && renderedRegion.durationSeconds > 0 && linkedTimeSeconds !== null)
    ? (linkedTimeSeconds - renderedRegion.startSeconds) / renderedRegion.durationSeconds * 100
    : -1;
  const showLinkedTime = !hover && linkedTimePercent >= 0 && linkedTimePercent <= 100;
  const timeAxisTicks = spectrogramResult?.timeAxisTicks ?? [];

  const getSpectrogramPosition = (event: React.MouseEvent<HTMLDivElement>): SpectrogramHover | null => {
    if (!renderedRegion || !renderedScale || renderedRegion.durationSeconds <= 0 || renderedNyquistHz <= 0) {
      return null;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const xFraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const yFraction = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    const scaledMaxFrequency = frequencyToScale(renderedNyquistHz, renderedScale);
    return {
      xPercent: xFraction * 100,
      yPercent: yFraction * 100,
      timeSeconds: renderedRegion.startSeconds + xFraction * renderedRegion.durationSeconds,
      frequencyHz: scaleToFrequency((1 - yFraction) * scaledMaxFrequency, renderedScale),
    };
  };

  const handleSpectrogramMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const position = getSpectrogramPosition(event);
    setHover(position);
    if (position) {
      dispatch(cursorFrequencyHovered(position.frequencyHz));
      dispatch(cursorTimeHovered(position.timeSeconds));
    }
  };

  const handleSpectrogramClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const position = getSpectrogramPosition(event);
    if (position) onSeek(position.timeSeconds);
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
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
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
            data={SPECTROGRAM_SCALE_OPTIONS}
            value={spectrogramUserParameters.scale}
            onChange={(value) => value && dispatch(spectrogramSetParameters({ scale: value as SpectrogramScale }))}
            aria-label="Spectrogram frequency scale"
            style={{ width: 88 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={SPECTROGRAM_FFT_SIZE_OPTIONS}
            value={String(spectrogramUserParameters.fftSize)}
            onChange={(value) => value && dispatch(spectrogramSetParameters({ fftSize: Number(value) }))}
            aria-label="FFT lines (frequency resolution)"
            title="FFT lines — higher = more frequency resolution, lower = more time resolution"
            style={{ width: 102 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={SPECTROGRAM_RANGE_OPTIONS}
            value={String(spectrogramUserParameters.rangeDb)}
            onChange={(value) => value && dispatch(spectrogramSetParameters({ rangeDb: Number(value) }))}
            aria-label="Spectrogram dynamic range"
            style={{ width: 86 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          <Select
            size="xs"
            data={SPECTROGRAM_GAIN_OPTIONS}
            value={String(spectrogramUserParameters.gainDb)}
            onChange={(value) => value && dispatch(spectrogramSetParameters({ gainDb: Number(value) }))}
            aria-label="Spectrogram gain"
            style={{ width: 86 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          {isRunning && <Loader size="xs" color="teal" />}
        </Group>
        <Group gap={2}>
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

        {effectiveFileId && spectrogramStatus !== 'error' && (
          <div className={styles.spectrogramFrame} style={{ height: canvasHeight + TIME_AXIS_HEIGHT }}>
            <div className={styles.spectrogramPlotRow} style={{ height: canvasHeight }}>
              <canvas
                ref={axisCanvasRef}
                style={{ flexShrink: 0, display: 'block' }}
                aria-label="Spectrogram frequency axis"
              />
              <div
                className={styles.spectrogramViewport}
                style={{ height: canvasHeight }}
                onClick={handleSpectrogramClick}
                onMouseMove={handleSpectrogramMouseMove}
                onMouseLeave={() => { setHover(null); dispatch(cursorFrequencyCleared()); dispatch(cursorTimeCleared()); }}
              >
                <canvas
                  key={canvasKey}
                  ref={canvasRef}
                  className={styles.spectrogramCanvas}
                  style={{ height: canvasHeight }}
                />
                {showPlayhead && (
                  <div className={styles.playhead} style={{ left: `${playheadPercent}%` }} />
                )}
                {showLinkedTime && (
                  <div className={styles.linkedTimeLine} style={{ left: `${linkedTimePercent}%` }} />
                )}
                {showLinkedFrequency && (
                  <>
                    <div className={styles.linkedFrequencyLine} style={{ top: `${linkedFrequencyPercent}%` }} />
                    <div className={styles.linkedReadout} style={{ top: `${linkedFrequencyPercent}%` }}>
                      {linkedFrequencyHz! >= 1000
                        ? `${(linkedFrequencyHz! / 1000).toFixed(2)} kHz`
                        : `${Math.round(linkedFrequencyHz!)} Hz`}
                    </div>
                  </>
                )}
                {hover && (
                  <>
                    <div className={styles.hoverTimeLine} style={{ left: `${hover.xPercent}%` }} />
                    <div className={styles.hoverFrequencyLine} style={{ top: `${hover.yPercent}%` }} />
                    <div
                      className={styles.hoverReadout}
                      style={{
                        left: `${Math.min(hover.xPercent + 1, 78)}%`,
                        top: `${Math.min(hover.yPercent + 3, 78)}%`,
                      }}
                    >
                      {hover.timeSeconds.toFixed(3)} s
                      <br />
                      {hover.frequencyHz >= 1000
                        ? `${(hover.frequencyHz / 1000).toFixed(2)} kHz`
                        : `${Math.round(hover.frequencyHz)} Hz`}
                    </div>
                  </>
                )}
                {isRunning && (
                  <div className={styles.loadingOverlay}>
                    <Loader size="sm" color="orange" />
                    <span>Updating spectrogram</span>
                  </div>
                )}
              </div>
              <div className={styles.colorbarAxis} style={{ height: canvasHeight }}>
                <canvas
                  ref={colorbarCanvasRef}
                  style={{ flexShrink: 0, display: 'block' }}
                  aria-label="Spectrogram color scale"
                />
                {colorbandLabel && (
                  <Text size="xs" ff="var(--font-mono)" c="dimmed" className={styles.colorbarAxisLabel}>
                    {colorbandLabel}
                  </Text>
                )}
              </div>
            </div>
            <div className={styles.timeAxisRow} aria-label="Spectrogram time axis">
              <div className={styles.timeAxisSpacer} />
              <div className={styles.timeAxisTrack}>
                {timeAxisTicks.map((tick) => (
                  <span
                    key={`${tick.positionPercent}-${tick.label}`}
                    className={styles.timeAxisTickLabel}
                    style={{ left: `${tick.positionPercent}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
              <div style={{ width: COLORBAR_WIDTH, flexShrink: 0 }} />
            </div>
          </div>
        )}
        {effectiveFileId && spectrogramStatus !== 'error' && (
          <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
        )}
      </div>
    </div>
  );
};
