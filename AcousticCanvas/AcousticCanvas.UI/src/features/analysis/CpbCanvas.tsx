import type { JSX } from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import type { CpbBand } from './cpbTypes';
import styles from './CpbCanvas.module.scss';

interface CpbCanvasProps {
  bands: CpbBand[];
  dbUnit: string | null;
  // Cross-panel linked frequency cursor (Hz) driven by hovering another panel.
  linkedFrequencyHz?: number | null;
  onHoverFrequency?: (frequencyHz: number | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  label: string;
  level: number;
  unit: string;
}

const MARGIN = { top: 12, right: 16, bottom: 44, left: 52 };
const GRID_COLOR = 'rgba(0,0,0,0.08)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';
const LABEL_COLOR = 'rgba(0,0,0,0.6)';
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const STEP_COLOR = '#e03131';
const LINKED_CURSOR_COLOR = 'rgba(0, 184, 169, 0.85)';
const Y_STEP = 10;

// Preferred CPB centre frequencies used for X-axis labelling.
const PREFERRED_HZ = [16, 31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Snap a coordinate to a crisp half-pixel so 1px strokes render sharp.
function crisp(value: number): number {
  return Math.round(value) + 0.5;
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k`;
  return `${hz}`;
}

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function floorTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function buildYAxisLabel(dbUnit: string | null): string {
  if (dbUnit && (dbUnit.includes('20 µPa') || dbUnit.includes('20µPa'))) return '[dB/20µPa]';
  if (dbUnit) return `[${dbUnit}]`;
  return '[dB]';
}

function drawCpb(
  canvas: HTMLCanvasElement,
  bands: CpbBand[],
  dbUnit: string | null,
  linkedFrequencyHz: number | null,
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx || bands.length === 0) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Only render bands whose level was computed by the backend.
  const visibleBands = bands.filter((band) => band.levelDb !== null);
  if (visibleBands.length === 0) return;

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  // X axis: logarithmic from the lowest band edge to the highest band edge.
  const fMin = Math.max(1, visibleBands[0].lowerFrequencyHz);
  const fMax = visibleBands[visibleBands.length - 1].upperFrequencyHz;
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  const toX = (freq: number): number =>
    MARGIN.left + ((Math.log10(Math.max(fMin, freq)) - logMin) / (logMax - logMin)) * plotWidth;

  // Y axis: snap to a 10 dB grid around the data range.
  const levels = visibleBands.map((band) => band.levelDb as number);
  const dataMax = Math.max(...levels);
  const dataMin = Math.min(...levels);
  const yMax = ceilTo(dataMax + 3, Y_STEP);
  const yMin = floorTo(dataMin - 6, Y_STEP);
  const toY = (value: number): number =>
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // Y grid lines.
  ctx.font = FONT;
  ctx.textAlign = 'right';
  for (let yValue = yMin; yValue <= yMax; yValue += Y_STEP) {
    const yPixel = crisp(toY(yValue));
    ctx.strokeStyle = yValue === 0 ? 'rgba(0,0,0,0.25)' : GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, yPixel);
    ctx.lineTo(MARGIN.left + plotWidth, yPixel);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(yValue.toFixed(0), MARGIN.left - 6, yPixel + 4);
  }

  // X grid lines + labels at preferred CPB frequencies within range.
  ctx.textAlign = 'center';
  for (const hz of PREFERRED_HZ) {
    if (hz < fMin || hz > fMax) continue;
    const xPixel = crisp(toX(hz));
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(formatHz(hz), xPixel, height - MARGIN.bottom + 14);
  }

  // X-axis title.
  ctx.fillStyle = AXIS_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('[Hz]', MARGIN.left + plotWidth / 2, height - 6);

  // Y-axis label — rotated.
  ctx.save();
  ctx.translate(13, MARGIN.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(buildYAxisLabel(dbUnit), 0, 0);
  ctx.restore();

  // Clip to plot area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
  ctx.clip();

  // Stepped (staircase) line. The backend supplies contiguous plot edges
  // (plotLowerFrequencyHz / plotUpperFrequencyHz) where each band's upper edge equals
  // the next band's lower edge, so every riser is vertical and there are no gaps.
  // Coordinates are pixel-snapped so horizontal/vertical segments stay crisp.
  ctx.beginPath();
  ctx.strokeStyle = STEP_COLOR;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'miter';
  for (let i = 0; i < visibleBands.length; i++) {
    const yPixel = crisp(toY(levels[i]));
    const xLeft = crisp(toX(visibleBands[i].plotLowerFrequencyHz));
    const xRight = crisp(toX(visibleBands[i].plotUpperFrequencyHz));
    if (i === 0) ctx.moveTo(xLeft, yPixel);
    else ctx.lineTo(xLeft, yPixel); // vertical riser at the shared band boundary
    ctx.lineTo(xRight, yPixel); // horizontal step
  }
  ctx.stroke();
  ctx.restore();

  // Linked frequency cursor.
  if (linkedFrequencyHz !== null && linkedFrequencyHz >= fMin && linkedFrequencyHz <= fMax) {
    const xPixel = crisp(toX(linkedFrequencyHz));
    ctx.save();
    ctx.strokeStyle = LINKED_CURSOR_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPixel, MARGIN.top);
    ctx.lineTo(xPixel, MARGIN.top + plotHeight);
    ctx.stroke();
    ctx.restore();
  }

  // Axis border.
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
}

export const CpbCanvas = ({
  bands,
  dbUnit,
  linkedFrequencyHz = null,
  onHoverFrequency,
}: CpbCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const draw = useCallback(() => {
    if (canvasRef.current) {
      drawCpb(canvasRef.current, bands, dbUnit, linkedFrequencyHz);
    }
  }, [bands, dbUnit, linkedFrequencyHz]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    const visibleBands = bands.filter((band) => band.levelDb !== null);
    if (!canvas || visibleBands.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const plotWidth = rect.width - MARGIN.left - MARGIN.right;

    const fMin = Math.max(1, visibleBands[0].lowerFrequencyHz);
    const fMax = visibleBands[visibleBands.length - 1].upperFrequencyHz;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);
    const normalizedX = (mouseX - MARGIN.left) / plotWidth;
    const freqAtMouse = 10 ** (logMin + normalizedX * (logMax - logMin));

    if (freqAtMouse < fMin || freqAtMouse > fMax) {
      setTooltip(null);
      onHoverFrequency?.(null);
      return;
    }

    const band = visibleBands.find((b) => freqAtMouse >= b.lowerFrequencyHz && freqAtMouse < b.upperFrequencyHz)
      ?? visibleBands[visibleBands.length - 1];
    onHoverFrequency?.(band.centerFrequencyHz);
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      label: band.label,
      level: band.levelDb as number,
      unit: dbUnit ?? 'dB',
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
          style={{
            left: Math.min(tooltip.x + 12, 240),
            top: Math.max(tooltip.y - 10, 4),
          }}
        >
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Hz</span>
            <span className={styles.tooltipValue}>{tooltip.label}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Lvl</span>
            <span className={styles.tooltipValue}>{tooltip.level.toFixed(1)} {tooltip.unit}</span>
          </div>
        </div>
      )}
    </div>
  );
};
