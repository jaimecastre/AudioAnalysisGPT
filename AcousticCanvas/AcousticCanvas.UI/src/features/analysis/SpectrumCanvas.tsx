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

// Log frequency scale mapping
function toLogX(freq: number, minFreq: number, maxFreq: number, plotWidth: number): number {
  const logMin = Math.log10(Math.max(minFreq, 1));
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(Math.max(freq, 1));
  const normalized = (logFreq - logMin) / (logMax - logMin);
  return MARGIN.left + normalized * plotWidth;
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

  // Use first channel for x-axis and as reference for y-axis scaling
  const firstChannel = channels[0];
  const yMode = firstChannel.yMode;
  const yUnit = firstChannel.yUnit;

  // Compute Y axis range across all channels.
  let yMin: number;
  let yMax: number;

  if (yMode === 'db') {
    const allDbValues = channels.flatMap(ch => ch.magnitudesDb.filter((v): v is number => v !== null));
    if (allDbValues.length === 0) {
      return;
    }
    const maxDb = Math.max(...allDbValues);
    yMax = maxDb + 6;
    yMin = maxDb - 100;
  } else {
    const allMagnitudes = channels.flatMap(ch => ch.magnitudes);
    yMax = Math.max(...allMagnitudes) * 1.1;
    yMin = 0;
  }

  const frequenciesHz = firstChannel.frequenciesHz;
  const xMax = frequenciesHz[frequenciesHz.length - 1];
  // Use sensible minimum for log scale (20 Hz, or first non-zero frequency)
  const xMin = Math.max(20, frequenciesHz.find(f => f > 0) ?? 20);

  // Use log scale for frequency axis (standard for audio spectrum)
  const toX = (freq: number): number =>
    toLogX(freq, xMin, xMax, plotWidth);

  const toY = (value: number): number =>
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // Draw grid lines — Y axis.
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.font = FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'right';

  const yStepCount = 5;
  const yStep = (yMax - yMin) / yStepCount;
  for (let i = 0; i <= yStepCount; i++) {
    const yValue = yMin + i * yStep;
    const yPixel = toY(yValue);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, yPixel);
    ctx.lineTo(MARGIN.left + plotWidth, yPixel);
    ctx.stroke();
    ctx.fillText(yValue.toFixed(0), MARGIN.left - 10, yPixel + 4);
  }

  // Draw grid lines — X axis (log-spaced frequency labels).
  ctx.textAlign = 'center';
  // Standard octave bands for log frequency axis
  const xLabels = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    f => f >= Math.max(xMin, 10) && f <= xMax
  );
  // Add min and max if not included
  if (xLabels[0] > xMin * 2) xLabels.unshift(Math.round(xMin));
  if (xLabels[xLabels.length - 1] < xMax * 0.8) xLabels.push(Math.round(xMax));

  for (const xValue of xLabels) {
    const xPixel = toX(xValue);
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(formatHz(xValue), xPixel, height - MARGIN.bottom + 14);
  }

  // X-axis title (below tick labels).
  ctx.fillStyle = AXIS_COLOR;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency [Hz]', MARGIN.left + plotWidth / 2, height - 6);

  // Y axis unit label — rotated.
  ctx.save();
  ctx.translate(18, MARGIN.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const yAxisLabel = yUnit ? `Magnitude [${yUnit}]` : 'Magnitude';
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();

  // Clip to plot area so spectrum lines stay within boundaries.
  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
  ctx.clip();

  // Draw each channel's spectrum line with different color.
  channels.forEach((channel, index) => {
    const lineColor = CHANNEL_COLORS[index % CHANNEL_COLORS.length];
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;

    let started = false;
    for (let i = 0; i < channel.frequenciesHz.length; i++) {
      const yValue = channel.yMode === 'db'
        ? (channel.magnitudesDb[i] ?? null)
        : channel.magnitudes[i];
      if (yValue === null) {
        continue;
      }
      const xPixel = toX(channel.frequenciesHz[i]);
      const yPixel = toY(yValue);

      if (!started) {
        ctx.moveTo(xPixel, yPixel);
        started = true;
      } else {
        ctx.lineTo(xPixel, yPixel);
      }
    }
    ctx.stroke();
  });

  ctx.restore();

  // Cross-panel linked frequency cursor: vertical guide at the shared frequency.
  if (linkedFrequencyHz !== null && linkedFrequencyHz >= xMin && linkedFrequencyHz <= xMax) {
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

  // Draw legend
  if (channels.length > 1) {
    const legendX = MARGIN.left + plotWidth - 10;
    const legendY = MARGIN.top + 10;
    const lineHeight = 14;

    channels.forEach((channel, index) => {
      const lineColor = CHANNEL_COLORS[index % CHANNEL_COLORS.length];
      const y = legendY + index * lineHeight;

      // Color indicator line (left of text with gap)
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX - 50, y);
      ctx.lineTo(legendX - 35, y);
      ctx.stroke();

      // Channel name (right-aligned at legendX)
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
    const xMin = Math.max(20, frequenciesHz.find(f => f > 0) ?? 20);

    // Convert mouse position to frequency using log scale
    const normalizedX = (mouseX - MARGIN.left) / plotWidth;
    const logMin = Math.log10(xMin);
    const logMax = Math.log10(xMax);
    const logFreq = logMin + normalizedX * (logMax - logMin);
    const freqAtMouse = Math.pow(10, logFreq);

    if (freqAtMouse < xMin || freqAtMouse > xMax * 1.05) {
      setTooltip(null);
      onHoverFrequency?.(null);
      return;
    }

    // Find nearest channel and index using log distance
    let nearestChannelIndex = 0;
    let nearestIndex = 0;
    let minLogDist = Infinity;

    channels.forEach((channel, chIndex) => {
      for (let i = 0; i < channel.frequenciesHz.length; i++) {
        const logDist = Math.abs(Math.log10(channel.frequenciesHz[i]) - Math.log10(freqAtMouse));
        if (logDist < minLogDist) {
          minLogDist = logDist;
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
