import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Badge } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize, IconChevronDown, IconChevronRight, IconX, IconWaveSine } from '@tabler/icons-react';
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
import { cursorFrequencyHovered, cursorFrequencyCleared, cursorFrequencyHzSelector } from './analysisCursorSlice';
import {
  SPECTROGRAM_FFT_SIZE_OPTIONS,
  SPECTROGRAM_GAIN_OPTIONS,
  SPECTROGRAM_RANGE_OPTIONS,
  SPECTROGRAM_SCALE_OPTIONS,
} from './spectrogramTypes';
import type { ChannelSpectrogramAnalysis, SpectrogramScale } from './spectrogramTypes';
import styles from './SpectrogramPanel.module.scss';

const DEFAULT_CANVAS_HEIGHT = 200;
const MIN_CANVAS_HEIGHT = 140;
const MAX_CANVAS_HEIGHT = 420;
const AXIS_WIDTH = 52;
const FONT = "10px 'JetBrains Mono', ui-monospace, monospace";
const LABEL_COLOR = 'rgba(0,0,0,0.45)';

// Pre-built 256-entry magma-style RGBA lookup table.
function buildColorTable(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  const stops = [
    { pos: 0,    r: 0,   g: 0,   b: 4   },
    { pos: 0.13, r: 27,  g: 12,  b: 65  },
    { pos: 0.25, r: 79,  g: 12,  b: 107 },
    { pos: 0.38, r: 120, g: 28,  b: 109 },
    { pos: 0.5,  r: 165, g: 44,  b: 96  },
    { pos: 0.63, r: 207, g: 68,  b: 70  },
    { pos: 0.75, r: 237, g: 105, b: 37  },
    { pos: 0.88, r: 251, g: 155, b: 6   },
    { pos: 1.0,  r: 252, g: 253, b: 191 },
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

// Draws frequency axis labels on a separate canvas.
function drawFrequencyAxis(
  axisCanvas: HTMLCanvasElement,
  nyquistHz: number,
  height: number,
  scale: SpectrogramScale,
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

  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const fraction = i / numTicks;
    const freqHz = scaleToFrequency(fraction * frequencyToScale(nyquistHz, scale), scale);
    const y = height - fraction * height;

    const labelText = freqHz >= 1000
      ? `${(freqHz / 1000).toFixed(1)} kHz`
      : `${Math.round(freqHz)} Hz`;

    ctx.fillText(labelText, AXIS_WIDTH - 4, Math.max(6, Math.min(y, height - 6)));
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
  const { runSpectrogram } = useRunSpectrogram();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

    const nyquistHz = spectrogramResult.parameters.sampleRate / 2;
    drawFrequencyAxis(axisCanvas, nyquistHz, canvasHeight, spectrogramResult.parameters.scale);
  }, [canvasHeight, spectrogramResult]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrogramStatus === 'running';
  const renderedRegion = spectrogramResult?.region;
  const renderedScale = spectrogramResult?.parameters.scale;
  const renderedNyquistHz = spectrogramResult ? spectrogramResult.parameters.sampleRate / 2 : 0;
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
            aria-label="Spectrogram FFT size"
            style={{ width: 82 }}
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
        {effectiveFileId && spectrogramStatus !== 'error' && (
          <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: canvasHeight }}>
            <canvas
              ref={axisCanvasRef}
              style={{ flexShrink: 0, display: 'block' }}
            />
            <div
              className={styles.spectrogramViewport}
              style={{ height: canvasHeight }}
              onClick={handleSpectrogramClick}
              onMouseMove={handleSpectrogramMouseMove}
              onMouseLeave={() => { setHover(null); dispatch(cursorFrequencyCleared()); }}
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
          </div>
        )}
        {effectiveFileId && spectrogramStatus !== 'error' && (
          <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
        )}
      </div>
    </div>
  );
};
