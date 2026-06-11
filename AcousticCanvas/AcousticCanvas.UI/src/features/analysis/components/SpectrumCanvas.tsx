import type { JSX } from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import styles from './SpectrumCanvas.module.scss';

interface SpectrumChannel {
  channelId: string;
  channelName: string;
  frequenciesHz: number[];
  magnitudes: number[];
  magnitudesDb: (number | null)[];
  yMode: 'db' | 'linear';
  yUnit: string;
  // Full label from backend e.g. 'Level [dB re 20 µPa]' or '[dBFS]'.
  // When present, used verbatim as the Y-axis title instead of the generic 'Magnitude [...]'.
  yAxisLabel?: string | null;
}

interface TooltipState {
  x: number;
  y: number;
  frequencyHz: number;
  magnitude: number;
  magnitudeDb: number | null;
  yUnit: string;
  channelName: string;
}

interface SpectrumCanvasProps {
  channels: SpectrumChannel[];
  xUnit?: string;
  // Cross-panel linked frequency cursor (Hz) driven by hovering another panel.
  linkedFrequencyHz?: number | null;
  onHoverFrequency?: (frequencyHz: number | null) => void;
}

const MARGIN = { top: 12, right: 16, bottom: 44, left: 52 };
const GRID_COLOR = 'rgba(0,0,0,0.08)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';
const LABEL_COLOR = 'rgba(0,0,0,0.6)';
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const AXIS_LINE_WIDTH = 1;

// Colors for different channels
const CHANNEL_COLORS = ['#00b8a9', '#e05252', '#4dabf7', '#fab005'];
const LINKED_CURSOR_COLOR = 'rgba(0, 184, 169, 0.85)';

function formatHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
  }
  return `${Math.round(hz)}`;
}

// Linear frequency scale mapping: 0 Hz at left, xMax at right.
function toLinearX(freq: number, xMax: number, plotWidth: number): number {
  return MARGIN.left + (freq / xMax) * plotWidth;
}

// Round up to nearest multiple of step.
function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

// Round down to nearest multiple of step.
function floorTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function drawSpectrum(
  canvas: HTMLCanvasElement,
  channels: SpectrumChannel[],
  linkedFrequencyHz: number | null,
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx || channels.length === 0 || channels[0].frequenciesHz.length === 0) {
    return;
  }

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const firstChannel = channels[0];
  const yMode = firstChannel.yMode;
  const yUnit = firstChannel.yUnit;

  // X axis: linear from 0 to Nyquist.
  const frequenciesHz = firstChannel.frequenciesHz;
  const xMax = frequenciesHz[frequenciesHz.length - 1];

  const toX = (freq: number): number => toLinearX(freq, xMax, plotWidth);

  // Y axis: snap to 10 dB grid around the data range.
  let yMin: number;
  let yMax: number;
  const Y_STEP = 10;

  if (yMode === 'db') {
    const allDbValues = channels.flatMap(ch => ch.magnitudesDb.filter((v): v is number => v !== null));
    if (allDbValues.length === 0) return;
    const dataMax = Math.max(...allDbValues);
    const dataMin = Math.min(...allDbValues);
    yMax = ceilTo(dataMax + 5, Y_STEP);
    yMin = floorTo(dataMin - 5, Y_STEP);
  } else {
    const allMagnitudes = channels.flatMap(ch => ch.magnitudes);
    yMax = Math.max(...allMagnitudes) * 1.1;
    yMin = 0;
  }

  const toY = (value: number): number =>
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // Y grid lines — every Y_STEP dB.
  ctx.font = FONT;
  ctx.textAlign = 'right';

  for (let yValue = yMin; yValue <= yMax; yValue += Y_STEP) {
    const yPixel = toY(yValue);
    ctx.strokeStyle = yValue === 0 ? 'rgba(0,0,0,0.25)' : GRID_COLOR;
    ctx.lineWidth = yValue === 0 ? 1 : 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, yPixel);
    ctx.lineTo(MARGIN.left + plotWidth, yPixel);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(yValue.toFixed(0), MARGIN.left - 6, yPixel + 4);
  }

  // X grid lines — evenly spaced, ~6–10 labels across Nyquist.
  // Pick a step size that gives ~8 divisions: round to nearest 1k, 2k, 5k etc.
  const rawStep = xMax / 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const xStep = magnitude * (normalised < 1.5 ? 1 : normalised < 3.5 ? 2 : normalised < 7.5 ? 5 : 10);

  ctx.textAlign = 'center';
  for (let xValue = 0; xValue <= xMax; xValue += xStep) {
    const xPixel = toX(xValue);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(formatHz(xValue), xPixel, height - MARGIN.bottom + 14);
  }

  // X-axis title.
  ctx.fillStyle = AXIS_COLOR;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[Hz]', MARGIN.left + plotWidth / 2, height - 6);

  // Y-axis label — rotated.
  ctx.save();
  ctx.translate(13, MARGIN.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = LABEL_COLOR;
  const yAxisLabel = firstChannel.yAxisLabel
    ? firstChannel.yAxisLabel
    : yUnit ? yUnit : '';
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();

  // Clip to plot area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
  ctx.clip();

  // Draw each channel's spectrum line.
  channels.forEach((channel, index) => {
    ctx.beginPath();
    ctx.strokeStyle = CHANNEL_COLORS[index % CHANNEL_COLORS.length];
    ctx.lineWidth = 1.5;

    let started = false;
    for (let i = 0; i < channel.frequenciesHz.length; i++) {
      const yValue = channel.yMode === 'db'
        ? (channel.magnitudesDb[i] ?? null)
        : channel.magnitudes[i];
      if (yValue === null) continue;
      const xPixel = toX(channel.frequenciesHz[i]);
      const yPixel = toY(yValue);
      if (!started) { ctx.moveTo(xPixel, yPixel); started = true; }
      else { ctx.lineTo(xPixel, yPixel); }
    }
    ctx.stroke();
  });

  ctx.restore();

  // Linked frequency cursor.
  if (linkedFrequencyHz !== null && linkedFrequencyHz >= 0 && linkedFrequencyHz <= xMax) {
    const xPixel = toX(linkedFrequencyHz);
    ctx.save();
    ctx.strokeStyle = LINKED_CURSOR_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.restore();
  }

  // Legend (multi-channel).
  if (channels.length > 1) {
    const legendX = MARGIN.left + plotWidth - 10;
    const legendY = MARGIN.top + 10;
    channels.forEach((channel, index) => {
      const y = legendY + index * 14;
      ctx.strokeStyle = CHANNEL_COLORS[index % CHANNEL_COLORS.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX - 50, y);
      ctx.lineTo(legendX - 35, y);
      ctx.stroke();
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(channel.channelName.slice(0, 10), legendX - 8, y);
    });
  }

  // Axis border.
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = AXIS_LINE_WIDTH;
  ctx.strokeRect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
}

export const SpectrumCanvas = ({
  channels,
  xUnit = 'Hz',
  linkedFrequencyHz = null,
  onHoverFrequency,
}: SpectrumCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const draw = useCallback(() => {
    if (canvasRef.current) {
      drawSpectrum(canvasRef.current, channels, linkedFrequencyHz);
    }
  }, [channels, linkedFrequencyHz]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas || channels.length === 0 || channels[0].frequenciesHz.length === 0) {
      return;
    }

    const firstChannel = channels[0];
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    const plotWidth = rect.width - MARGIN.left - MARGIN.right;
    const frequenciesHz = firstChannel.frequenciesHz;
    const xMax = frequenciesHz[frequenciesHz.length - 1];

    // Convert mouse position to frequency using linear scale.
    const normalizedX = (mouseX - MARGIN.left) / plotWidth;
    const freqAtMouse = normalizedX * xMax;

    if (freqAtMouse < 0 || freqAtMouse > xMax * 1.02) {
      setTooltip(null);
      onHoverFrequency?.(null);
      return;
    }

    // Find nearest frequency index (linear distance).
    let nearestChannelIndex = 0;
    let nearestIndex = 0;
    let minDist = Infinity;

    channels.forEach((channel, chIndex) => {
      for (let i = 0; i < channel.frequenciesHz.length; i++) {
        const dist = Math.abs(channel.frequenciesHz[i] - freqAtMouse);
        if (dist < minDist) {
          minDist = dist;
          nearestChannelIndex = chIndex;
          nearestIndex = i;
        }
      }
    });

    const nearestChannel = channels[nearestChannelIndex];
    onHoverFrequency?.(nearestChannel.frequenciesHz[nearestIndex]);
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      frequencyHz: nearestChannel.frequenciesHz[nearestIndex],
      magnitude: nearestChannel.magnitudes[nearestIndex],
      magnitudeDb: nearestChannel.magnitudesDb[nearestIndex],
      yUnit: nearestChannel.yUnit,
      channelName: nearestChannel.channelName,
    });
  };

  const handleMouseLeave = (): void => {
    setTooltip(null);
    onHoverFrequency?.(null);
  };

  return (
    <div className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {channels.length > 1 && (
            <span className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Ch</span>
              <span className={styles.tooltipValue}>{tooltip.channelName}</span>
            </span>
          )}
          <span className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>{xUnit}</span>
            <span className={styles.tooltipValue}>{tooltip.frequencyHz.toFixed(1)}</span>
          </span>
          {tooltip.magnitudeDb !== null ? (
            <span className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>{tooltip.yUnit}</span>
              <span className={styles.tooltipValue}>{tooltip.magnitudeDb.toFixed(2)}</span>
            </span>
          ) : (
            <span className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>{tooltip.yUnit}</span>
              <span className={styles.tooltipValue}>{tooltip.magnitude.toExponential(3)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
