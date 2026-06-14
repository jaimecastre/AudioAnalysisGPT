import type { JSX, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Loader, Text } from '@mantine/core';
import type { SpectrogramAnalysis, SpectrogramAxisTick, SpectrogramScale } from '../types/spectrogramTypes';
import styles from './SpectrogramPanel.module.scss';

const AXIS_WIDTH = 60;
const COLORBAR_WIDTH = 85;
export const SPECTROGRAM_TIME_AXIS_HEIGHT = 24;
const FONT = "10px 'JetBrains Mono', ui-monospace, monospace";
const LABEL_COLOR = 'rgba(0,0,0,0.45)';

interface ISpectrogramPlotProps {
  result: SpectrogramAnalysis;
  height: number;
  currentTimeSeconds?: number;
  linkedFrequencyHz?: number | null;
  linkedTimeSeconds?: number | null;
  isLoading?: boolean;
  loadingLabel?: string;
  onSeek?: (timeSeconds: number) => void;
  onCursorChange?: (position: SpectrogramPlotCursor) => void;
  onCursorLeave?: () => void;
}

export interface SpectrogramPlotCursor {
  xPercent: number;
  yPercent: number;
  timeSeconds: number;
  frequencyHz: number;
}

const COLOR_TABLE = buildColorTable();

export const SpectrogramPlot = ({
  result,
  height,
  currentTimeSeconds,
  linkedFrequencyHz,
  linkedTimeSeconds,
  isLoading = false,
  loadingLabel = 'Updating spectrogram',
  onSeek,
  onCursorChange,
  onCursorLeave,
}: ISpectrogramPlotProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorbarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<SpectrogramPlotCursor | null>(null);

  const primaryChannel = result.channels[0] ?? null;
  const renderedRegion = result.region;
  const renderedScale = result.parameters.scale;
  const renderedNyquistHz = result.parameters.sampleRate / 2;
  const colorbandLabel = primaryChannel?.colorbandLabel;
  const timeAxisTicks = result.timeAxisTicks ?? [];
  const canvasKey = `${result.parameters.fftSize}-${result.region.startSeconds}-${result.region.endSeconds}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const axisCanvas = axisCanvasRef.current;
    if (!canvas || !axisCanvas || !primaryChannel) return;
    if (primaryChannel.frequencyData.length === 0) return;

    drawSpectrogramToCanvas(canvas, primaryChannel.frequencyData);
    drawFrequencyAxis(axisCanvas, result.frequencyAxisTicks ?? [], height);

    const colorbarCanvas = colorbarCanvasRef.current;
    if (colorbarCanvas) {
      drawColorbar(
        colorbarCanvas,
        result.parameters.minDbSpl,
        result.parameters.maxDbSpl,
        height,
      );
    }
  }, [height, primaryChannel, result]);

  const playheadPercent = currentTimeSeconds !== undefined && renderedRegion.durationSeconds > 0
    ? (currentTimeSeconds - renderedRegion.startSeconds) / renderedRegion.durationSeconds * 100
    : -1;
  const showPlayhead = playheadPercent >= 0 && playheadPercent <= 100;

  const linkedFrequencyPercent = linkedFrequencyHz !== null && linkedFrequencyHz !== undefined && renderedNyquistHz > 0
    ? (1 - frequencyToScale(linkedFrequencyHz, renderedScale) / frequencyToScale(renderedNyquistHz, renderedScale)) * 100
    : -1;
  const showLinkedFrequency = !hover && linkedFrequencyPercent >= 0 && linkedFrequencyPercent <= 100;

  const linkedTimePercent = linkedTimeSeconds !== null && linkedTimeSeconds !== undefined && renderedRegion.durationSeconds > 0
    ? (linkedTimeSeconds - renderedRegion.startSeconds) / renderedRegion.durationSeconds * 100
    : -1;
  const showLinkedTime = !hover && linkedTimePercent >= 0 && linkedTimePercent <= 100;

  const getSpectrogramPosition = (event: MouseEvent<HTMLDivElement>): SpectrogramPlotCursor | null => {
    if (renderedRegion.durationSeconds <= 0 || renderedNyquistHz <= 0) {
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

  const handleSpectrogramMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    const position = getSpectrogramPosition(event);
    setHover(position);
    if (position) {
      onCursorChange?.(position);
    }
  };

  const handleSpectrogramClick = (event: MouseEvent<HTMLDivElement>): void => {
    const position = getSpectrogramPosition(event);
    if (position) {
      onSeek?.(position.timeSeconds);
    }
  };

  const handleMouseLeave = (): void => {
    setHover(null);
    onCursorLeave?.();
  };

  return (
    <div className={styles.spectrogramFrame} style={{ height: height + SPECTROGRAM_TIME_AXIS_HEIGHT }}>
      <div className={styles.spectrogramPlotRow} style={{ height }}>
        <canvas
          ref={axisCanvasRef}
          style={{ flexShrink: 0, display: 'block' }}
          aria-label="Spectrogram frequency axis"
        />
        <div
          className={styles.spectrogramViewport}
          style={{ height }}
          onClick={handleSpectrogramClick}
          onMouseMove={handleSpectrogramMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <canvas
            key={canvasKey}
            ref={canvasRef}
            className={styles.spectrogramCanvas}
            style={{ height }}
            aria-label="Spectrogram"
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
                {formatFrequency(linkedFrequencyHz!)}
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
                {formatFrequency(hover.frequencyHz)}
              </div>
            </>
          )}
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <Loader size="sm" color="orange" />
              <span>{loadingLabel}</span>
            </div>
          )}
        </div>
        <div className={styles.colorbarAxis} style={{ height }}>
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
  );
};

function buildColorTable(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  const stops = [
    { pos: 0.00, r: 0,   g: 0,   b: 0   },
    { pos: 0.12, r: 10,  g: 0,   b: 60  },
    { pos: 0.23, r: 0,   g: 30,  b: 160 },
    { pos: 0.35, r: 50,  g: 40,  b: 230 },
    { pos: 0.46, r: 150, g: 0,   b: 230 },
    { pos: 0.55, r: 255, g: 0,   b: 210 },
    { pos: 0.63, r: 255, g: 0,   b: 110 },
    { pos: 0.72, r: 255, g: 0,   b: 0   },
    { pos: 0.80, r: 255, g: 90,  b: 0   },
    { pos: 0.88, r: 255, g: 210, b: 0   },
    { pos: 0.95, r: 255, g: 250, b: 150 },
    { pos: 1.00, r: 255, g: 255, b: 255 },
  ];

  for (let index = 0; index < 256; index++) {
    const progress = index / 255;
    let stopIndex = 0;
    for (let stop = 0; stop < stops.length - 1; stop++) {
      if (progress >= stops[stop].pos) {
        stopIndex = stop;
      }
    }

    const start = stops[stopIndex];
    const end = stops[Math.min(stopIndex + 1, stops.length - 1)];
    const span = end.pos - start.pos;
    const fraction = span > 0 ? (progress - start.pos) / span : 0;

    table[index * 4] = Math.round(start.r + (end.r - start.r) * fraction);
    table[index * 4 + 1] = Math.round(start.g + (end.g - start.g) * fraction);
    table[index * 4 + 2] = Math.round(start.b + (end.b - start.b) * fraction);
    table[index * 4 + 3] = 255;
  }

  return table;
}

function drawSpectrogramToCanvas(
  canvas: HTMLCanvasElement,
  frequencyData: string[],
): void {
  const frameCount = frequencyData.length;
  const decodedFrames = frequencyData.map(decodeBase64Frame);
  const binCount = decodedFrames[0]?.length ?? 0;
  if (frameCount === 0 || binCount === 0) return;

  canvas.width = frameCount;
  canvas.height = binCount;

  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.createImageData(frameCount, binCount);
  const pixels = imageData.data;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const frame = decodedFrames[frameIndex];
    for (let binIndex = 0; binIndex < binCount; binIndex++) {
      const value = frame[binIndex];
      const flippedBin = binCount - 1 - binIndex;
      const pixelOffset = (flippedBin * frameCount + frameIndex) * 4;
      pixels[pixelOffset] = COLOR_TABLE[value * 4];
      pixels[pixelOffset + 1] = COLOR_TABLE[value * 4 + 1];
      pixels[pixelOffset + 2] = COLOR_TABLE[value * 4 + 2];
      pixels[pixelOffset + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function decodeBase64Frame(encodedFrame: string): Uint8Array {
  const binaryFrame = window.atob(encodedFrame);
  const decodedFrame = new Uint8Array(binaryFrame.length);
  for (let index = 0; index < binaryFrame.length; index++) {
    decodedFrame[index] = binaryFrame.charCodeAt(index);
  }
  return decodedFrame;
}

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

  const context = axisCanvas.getContext('2d');
  if (!context) return;

  context.scale(dpr, dpr);
  context.clearRect(0, 0, AXIS_WIDTH, height);
  context.font = FONT;
  context.fillStyle = LABEL_COLOR;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.strokeStyle = LABEL_COLOR;
  context.lineWidth = 1;

  for (const tick of ticks) {
    const y = tick.positionPercent / 100 * height;
    const clampedY = Math.max(2, Math.min(y, height - 10));
    context.beginPath();
    context.moveTo(AXIS_WIDTH, clampedY);
    context.lineTo(AXIS_WIDTH - 4, clampedY);
    context.stroke();
    context.fillText(tick.label, AXIS_WIDTH - 6, clampedY);
  }
}

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

  const context = colorbarCanvas.getContext('2d');
  if (!context) return;

  context.scale(dpr, dpr);
  context.clearRect(0, 0, COLORBAR_WIDTH, height);

  const barX = 4;
  const barWidth = 10;
  for (let py = 0; py < height; py++) {
    const fraction = 1 - py / Math.max(1, height - 1);
    const byteValue = Math.round(fraction * 255);
    const red = COLOR_TABLE[byteValue * 4];
    const green = COLOR_TABLE[byteValue * 4 + 1];
    const blue = COLOR_TABLE[byteValue * 4 + 2];
    context.fillStyle = `rgb(${red},${green},${blue})`;
    context.fillRect(barX, py, barWidth, 1);
  }

  const tickX = barX + barWidth;
  const dbRange = maxDbSpl - minDbSpl;
  context.font = FONT;
  context.fillStyle = LABEL_COLOR;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.strokeStyle = LABEL_COLOR;
  context.lineWidth = 1;

  const firstTick = Math.ceil(minDbSpl / 10) * 10;
  for (let db = firstTick; db <= maxDbSpl; db += 10) {
    const fraction = (db - minDbSpl) / dbRange;
    const y = height - fraction * height;
    const clampedY = Math.max(5, Math.min(y, height - 5));
    context.beginPath();
    context.moveTo(tickX, clampedY);
    context.lineTo(tickX + 3, clampedY);
    context.stroke();
    context.fillText(`${db}`, tickX + 5, clampedY);
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

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  }
  return `${Math.round(frequencyHz)} Hz`;
}
