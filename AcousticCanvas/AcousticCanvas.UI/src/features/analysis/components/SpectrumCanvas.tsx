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

interface ViewRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
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

// Returns a stable color for a channel by its id (e.g. 'ch1', 'ch2').
// Falls back to the loop index so callers can always pass a fallback.
function channelColor(channelId: string, fallbackIndex: number): string {
  const match = /\d+$/.exec(channelId);
  const slot = match ? (parseInt(match[0], 10) - 1) : fallbackIndex;
  return CHANNEL_COLORS[slot % CHANNEL_COLORS.length];
}

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

const HOVER_CURSOR_COLOR = 'rgba(80, 80, 80, 0.6)';
const HOVER_DOT_RADIUS = 3.5;

/** Compute the full data extent (used as zoom-out cap). */
function computeFullExtent(channels: SpectrumChannel[]): ViewRange {
  const firstChannel = channels[0];
  const frequenciesHz = firstChannel.frequenciesHz;
  const xMax = frequenciesHz[frequenciesHz.length - 1];
  const Y_STEP = 10;
  let yMin: number;
  let yMax: number;
  if (firstChannel.yMode === 'db') {
    const allDbValues = channels.flatMap(ch => ch.magnitudesDb.filter((v): v is number => v !== null));
    if (allDbValues.length === 0) return { xMin: 0, xMax, yMin: 0, yMax: 100 };
    yMax = ceilTo(Math.max(...allDbValues) + 5, Y_STEP);
    yMin = floorTo(Math.min(...allDbValues) - 5, Y_STEP);
  } else {
    const allMagnitudes = channels.flatMap(ch => ch.magnitudes);
    yMax = Math.max(...allMagnitudes) * 1.1;
    yMin = 0;
  }
  return { xMin: 0, xMax, yMin, yMax };
}

function drawSpectrum(
  canvas: HTMLCanvasElement,
  channels: SpectrumChannel[],
  linkedFrequencyHz: number | null,
  hoverFrequencyHz: number | null = null,
  viewRange: ViewRange | null = null,
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

  // Use viewRange if provided (zoomed), otherwise fit to full data.
  let xMin: number;
  let xMax: number;
  let yMin: number;
  let yMax: number;
  const Y_STEP = 10;

  if (viewRange) {
    xMin = viewRange.xMin;
    xMax = viewRange.xMax;
    yMin = viewRange.yMin;
    yMax = viewRange.yMax;
  } else {
    const extent = computeFullExtent(channels);
    xMin = extent.xMin;
    xMax = extent.xMax;
    yMin = extent.yMin;
    yMax = extent.yMax;
  }

  const toX = (freq: number): number =>
    MARGIN.left + ((freq - xMin) / (xMax - xMin)) * plotWidth;

  const toY = (value: number): number =>
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // Y grid lines — pick step dynamically based on visible range.
  const yRange = yMax - yMin;
  const yGridStep = yRange <= 30 ? 5 : Y_STEP;
  ctx.font = FONT;
  ctx.textAlign = 'right';

  for (let yValue = floorTo(yMin, yGridStep); yValue <= yMax; yValue += yGridStep) {
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

  // X grid lines — evenly spaced, ~6–10 labels across visible range.
  const xRange = xMax - xMin;
  const rawStep = xRange / 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const xStep = magnitude * (normalised < 1.5 ? 1 : normalised < 3.5 ? 2 : normalised < 7.5 ? 5 : 10);

  ctx.textAlign = 'center';
  for (let xValue = ceilTo(xMin, xStep); xValue <= xMax; xValue += xStep) {
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
    ctx.strokeStyle = channelColor(channel.channelId, index);
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

  // Legend (multi-channel).
  if (channels.length > 1) {
    const legendX = MARGIN.left + plotWidth - 10;
    const legendY = MARGIN.top + 10;
    channels.forEach((channel, index) => {
      const y = legendY + index * 14;
      ctx.strokeStyle = channelColor(channel.channelId, index);
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

  // Hover cursor — vertical line + dots at intersection with each channel.
  if (hoverFrequencyHz !== null && hoverFrequencyHz >= xMin && hoverFrequencyHz <= xMax) {
    const xPixel = toX(hoverFrequencyHz);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = HOVER_CURSOR_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw a dot at each channel's magnitude at this frequency.
    channels.forEach((channel, index) => {
      // Find nearest frequency bin.
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < channel.frequenciesHz.length; i++) {
        const dist = Math.abs(channel.frequenciesHz[i] - hoverFrequencyHz);
        if (dist < minDist) { minDist = dist; nearest = i; }
      }
      const yValue = yMode === 'db'
        ? (channel.magnitudesDb[nearest] ?? null)
        : channel.magnitudes[nearest];
      if (yValue === null) return;
      const yPixel = toY(yValue);
      ctx.fillStyle = channelColor(channel.channelId, index);
      ctx.beginPath();
      ctx.arc(xPixel, yPixel, HOVER_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
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
  const hoverFreqRef = useRef<number | null>(null);
  const [viewRange, setViewRange] = useState<ViewRange | null>(null);
  const viewRangeRef = useRef<ViewRange | null>(null);

  // Keep ref in sync with state (ref is source of truth for event handlers).
  const updateViewRange = (range: ViewRange | null): void => {
    viewRangeRef.current = range;
    setViewRange(range);
  };

  // Reset zoom only when the underlying data actually changes (not on every render).
  const dataFingerprint = channels.length > 0
    ? `${channels.length}_${channels[0].frequenciesHz.length}_${channels[0].frequenciesHz[channels[0].frequenciesHz.length - 1]}`
    : '';
  useEffect(() => {
    updateViewRange(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFingerprint]);

  const draw = useCallback(() => {
    if (canvasRef.current) {
      drawSpectrum(canvasRef.current, channels, linkedFrequencyHz, hoverFreqRef.current, viewRange);
    }
  }, [channels, linkedFrequencyHz, viewRange]);

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

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    const plotWidth = rect.width - MARGIN.left - MARGIN.right;
    const extent = computeFullExtent(channels);
    const currentRange = viewRangeRef.current ?? extent;

    // Convert mouse position to frequency using current view range.
    const normalizedX = (mouseX - MARGIN.left) / plotWidth;
    const freqAtMouse = currentRange.xMin + normalizedX * (currentRange.xMax - currentRange.xMin);

    if (freqAtMouse < currentRange.xMin || freqAtMouse > currentRange.xMax * 1.02) {
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
    const hoverFreq = nearestChannel.frequenciesHz[nearestIndex];
    hoverFreqRef.current = hoverFreq;
    onHoverFrequency?.(hoverFreq);
    // Redraw to show the cursor line.
    if (canvasRef.current) {
      drawSpectrum(canvasRef.current, channels, linkedFrequencyHz, hoverFreq, viewRangeRef.current);
    }
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      frequencyHz: hoverFreq,
      magnitude: nearestChannel.magnitudes[nearestIndex],
      magnitudeDb: nearestChannel.magnitudesDb[nearestIndex],
      yUnit: nearestChannel.yUnit,
      channelName: nearestChannel.channelName,
    });
  };

  const handleMouseLeave = (): void => {
    hoverFreqRef.current = null;
    setTooltip(null);
    onHoverFrequency?.(null);
    // Redraw to clear the cursor line.
    if (canvasRef.current) {
      drawSpectrum(canvasRef.current, channels, linkedFrequencyHz, null, viewRangeRef.current);
    }
  };

  const handleWheel = useCallback((event: WheelEvent): void => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || channels.length === 0 || channels[0].frequenciesHz.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const plotWidth = rect.width - MARGIN.left - MARGIN.right;
    const plotHeight = rect.height - MARGIN.top - MARGIN.bottom;

    const extent = computeFullExtent(channels);
    const current = viewRangeRef.current ?? extent;

    // Zoom factor: scroll up = zoom in, scroll down = zoom out.
    const zoomFactor = event.deltaY > 0 ? 1.2 : 1 / 1.2;

    // Position of cursor as fraction within plot area.
    const xFrac = Math.max(0, Math.min(1, (mouseX - MARGIN.left) / plotWidth));
    const yFrac = Math.max(0, Math.min(1, (mouseY - MARGIN.top) / plotHeight));

    // Frequency and magnitude at cursor.
    const freqAtCursor = current.xMin + xFrac * (current.xMax - current.xMin);
    const valAtCursor = current.yMax - yFrac * (current.yMax - current.yMin);

    // New range widths.
    let newXRange = (current.xMax - current.xMin) * zoomFactor;
    let newYRange = (current.yMax - current.yMin) * zoomFactor;

    // Cap zoom out to full data extent.
    const extentXRange = extent.xMax - extent.xMin;
    const extentYRange = extent.yMax - extent.yMin;
    if (newXRange >= extentXRange) newXRange = extentXRange;
    if (newYRange >= extentYRange) newYRange = extentYRange;

    // Center the zoom on the cursor position.
    let newXMin = freqAtCursor - xFrac * newXRange;
    let newXMax = freqAtCursor + (1 - xFrac) * newXRange;
    let newYMin = valAtCursor - (1 - yFrac) * newYRange;
    let newYMax = valAtCursor + yFrac * newYRange;

    // Clamp to data extent boundaries.
    if (newXMin < extent.xMin) { newXMax += (extent.xMin - newXMin); newXMin = extent.xMin; }
    if (newXMax > extent.xMax) { newXMin -= (newXMax - extent.xMax); newXMax = extent.xMax; }
    newXMin = Math.max(newXMin, extent.xMin);
    newXMax = Math.min(newXMax, extent.xMax);

    if (newYMin < extent.yMin) { newYMax += (extent.yMin - newYMin); newYMin = extent.yMin; }
    if (newYMax > extent.yMax) { newYMin -= (newYMax - extent.yMax); newYMax = extent.yMax; }
    newYMin = Math.max(newYMin, extent.yMin);
    newYMax = Math.min(newYMax, extent.yMax);

    // If at full extent, clear viewRange (null = auto-fit).
    if (newXRange >= extentXRange && newYRange >= extentYRange) {
      updateViewRange(null);
    } else {
      updateViewRange({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax });
    }
  }, [channels, linkedFrequencyHz]);

  // Attach wheel handler imperatively with passive: false so preventDefault works.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
