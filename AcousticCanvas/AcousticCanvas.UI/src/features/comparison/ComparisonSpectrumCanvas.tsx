import type { JSX } from 'react';
import { useRef, useEffect, useState } from 'react';
import type { CompareSpectrumCurve, CompareSpectrumDelta } from '../agent/agentToolTypes';
import styles from './ComparisonSpectrumCanvas.module.scss';

interface ComparisonSpectrumCanvasProps {
  curveA: CompareSpectrumCurve;
  curveB: CompareSpectrumCurve;
  delta: CompareSpectrumDelta;
  labelA: string;
  labelB: string;
  showDelta: boolean;
}

interface TooltipState {
  x: number;
  y: number;
  frequencyHz: number;
  magnitudeDbA: number | null;
  magnitudeDbB: number | null;
  deltaDb: number | null;
}

const MARGIN = { top: 16, right: 20, bottom: 48, left: 56 };
const GRID_COLOR = 'rgba(0,0,0,0.07)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';
const LABEL_COLOR = 'rgba(0,0,0,0.5)';
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

const COLOR_A = '#1971c2';
const COLOR_B = '#e8590c';
const COLOR_DELTA = '#2f9e44';

function formatHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
  }
  return `${Math.round(hz)}`;
}

function toLogX(freq: number, minFreq: number, maxFreq: number, plotWidth: number, marginLeft: number): number {
  const logMin = Math.log10(Math.max(minFreq, 1));
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(Math.max(freq, 1));
  const normalized = (logFreq - logMin) / (logMax - logMin);
  return marginLeft + normalized * plotWidth;
}

function findNearestBinIndex(frequenciesHz: number[], targetHz: number): number {
  let nearestIndex = 0;
  let nearestDistance = Math.abs(frequenciesHz[0] - targetHz);

  for (let k = 1; k < frequenciesHz.length; k++) {
    const distance = Math.abs(frequenciesHz[k] - targetHz);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = k;
    }
  }

  return nearestIndex;
}

function drawComparisonSpectrum(
  canvas: HTMLCanvasElement,
  curveA: CompareSpectrumCurve,
  curveB: CompareSpectrumCurve,
  delta: CompareSpectrumDelta,
  showDelta: boolean,
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx || curveA.frequenciesHz.length === 0 || curveB.frequenciesHz.length === 0) {
    return;
  }

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  // Collect all non-null dB values across both curves to determine Y range.
  const allDbValues: number[] = [];
  for (const v of curveA.magnitudesDb) {
    if (v !== null) allDbValues.push(v);
  }
  for (const v of curveB.magnitudesDb) {
    if (v !== null) allDbValues.push(v);
  }

  if (allDbValues.length === 0) {
    return;
  }

  const maxDb = Math.max(...allDbValues);
  const yMax = maxDb + 6;
  const yMin = maxDb - 100;

  const frequenciesHz = curveA.frequenciesHz;
  const xMax = frequenciesHz[frequenciesHz.length - 1];
  const firstNonZeroFreq = frequenciesHz.find((f) => f > 0) ?? 20;
  const xMin = Math.max(20, firstNonZeroFreq);

  const toX = (freq: number): number =>
    toLogX(freq, xMin, xMax, plotWidth, MARGIN.left);

  const toY = (value: number): number =>
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // --- Y grid lines ---
  ctx.font = FONT;
  ctx.textAlign = 'right';
  const yStepCount = 5;
  const yStep = (yMax - yMin) / yStepCount;

  for (let i = 0; i <= yStepCount; i++) {
    const yValue = yMin + i * yStep;
    const yPixel = toY(yValue);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, yPixel);
    ctx.lineTo(MARGIN.left + plotWidth, yPixel);
    ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(`${yValue.toFixed(0)}`, MARGIN.left - 8, yPixel + 4);
  }

  // --- X grid lines (log-spaced) ---
  ctx.textAlign = 'center';
  const xLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    (f) => f >= xMin && f <= xMax,
  );

  for (const xValue of xLabels) {
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

  // --- Axis labels ---
  ctx.fillStyle = AXIS_COLOR;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency [Hz]', MARGIN.left + plotWidth / 2, height - 6);

  ctx.save();
  ctx.translate(16, MARGIN.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Magnitude [dBFS]', 0, 0);
  ctx.restore();

  // Clip to plot area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight);
  ctx.clip();

  // --- Draw curve A ---
  ctx.beginPath();
  ctx.strokeStyle = COLOR_A;
  ctx.lineWidth = 1.5;
  let startedA = false;
  for (let k = 0; k < curveA.frequenciesHz.length; k++) {
    const db = curveA.magnitudesDb[k];
    if (db === null) continue;
    const xPixel = toX(curveA.frequenciesHz[k]);
    const yPixel = toY(db);
    if (!startedA) {
      ctx.moveTo(xPixel, yPixel);
      startedA = true;
    } else {
      ctx.lineTo(xPixel, yPixel);
    }
  }
  ctx.stroke();

  // --- Draw curve B ---
  ctx.beginPath();
  ctx.strokeStyle = COLOR_B;
  ctx.lineWidth = 1.5;
  let startedB = false;
  for (let k = 0; k < curveB.frequenciesHz.length; k++) {
    const db = curveB.magnitudesDb[k];
    if (db === null) continue;
    const xPixel = toX(curveB.frequenciesHz[k]);
    const yPixel = toY(db);
    if (!startedB) {
      ctx.moveTo(xPixel, yPixel);
      startedB = true;
    } else {
      ctx.lineTo(xPixel, yPixel);
    }
  }
  ctx.stroke();

  // --- Draw delta curve (B − A) on its own ±30 dB scale ---
  // The delta zero line sits at the top quarter of the plot.
  // This keeps it visually separate from the spectrum curves below.
  if (showDelta && delta.frequenciesHz.length > 0) {
    const deltaRange = 30; // ± dB shown above and below zero line
    const deltaZeroY = MARGIN.top + plotHeight * 0.22;
    const deltaScale = (plotHeight * 0.22) / deltaRange; // px per dB

    const toDeltaY = (deltaDb: number): number =>
      deltaZeroY - deltaDb * deltaScale;

    // Draw the Δ = 0 reference line (light dashed).
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(47,158,68,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.moveTo(MARGIN.left, deltaZeroY);
    ctx.lineTo(MARGIN.left + plotWidth, deltaZeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label the zero line.
    ctx.fillStyle = COLOR_DELTA;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Δ 0 dB', MARGIN.left + 4, deltaZeroY - 3);

    // Draw the delta curve.
    ctx.beginPath();
    ctx.strokeStyle = COLOR_DELTA;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    let startedDelta = false;
    for (let k = 0; k < delta.frequenciesHz.length; k++) {
      const db = delta.deltaDb[k];
      if (db === null) continue;
      const xPixel = toX(delta.frequenciesHz[k]);
      const yPixel = toDeltaY(db);
      if (!startedDelta) {
        ctx.moveTo(xPixel, yPixel);
        startedDelta = true;
      } else {
        ctx.lineTo(xPixel, yPixel);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export function ComparisonSpectrumCanvas({
  curveA,
  curveB,
  delta,
  labelA,
  labelB,
  showDelta,
}: ComparisonSpectrumCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawComparisonSpectrum(canvas, curveA, curveB, delta, showDelta);

    const resizeObserver = new ResizeObserver(() => {
      drawComparisonSpectrum(canvas, curveA, curveB, delta, showDelta);
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [curveA, curveB, delta, showDelta]);

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (!canvas || curveA.frequenciesHz.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    const plotWidth = rect.width - MARGIN.left - MARGIN.right;
    if (mouseX < MARGIN.left || mouseX > MARGIN.left + plotWidth) {
      setTooltip(null);
      return;
    }

    const firstNonZeroFreq = curveA.frequenciesHz.find((f) => f > 0) ?? 20;
    const xMin = Math.max(20, firstNonZeroFreq);
    const xMax = curveA.frequenciesHz[curveA.frequenciesHz.length - 1];

    const logMin = Math.log10(Math.max(xMin, 1));
    const logMax = Math.log10(xMax);
    const normalizedX = (mouseX - MARGIN.left) / plotWidth;
    const targetLogFreq = logMin + normalizedX * (logMax - logMin);
    const targetHz = Math.pow(10, targetLogFreq);

    const nearestIndexA = findNearestBinIndex(curveA.frequenciesHz, targetHz);
    const nearestIndexB = findNearestBinIndex(curveB.frequenciesHz, targetHz);
    const nearestIndexDelta = delta.frequenciesHz.length > 0
      ? findNearestBinIndex(delta.frequenciesHz, targetHz)
      : -1;

    setTooltip({
      x: mouseX,
      y: event.clientY - rect.top,
      frequencyHz: curveA.frequenciesHz[nearestIndexA],
      magnitudeDbA: curveA.magnitudesDb[nearestIndexA],
      magnitudeDbB: curveB.magnitudesDb[nearestIndexB],
      deltaDb: nearestIndexDelta >= 0 ? delta.deltaDb[nearestIndexDelta] : null,
    });
  }

  function handleMouseLeave(): void {
    setTooltip(null);
  }

  return (
    <div className={styles.canvasWrapper}>
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
          <span className={styles.tooltipFreq}>{formatHz(tooltip.frequencyHz)} Hz</span>
          <span className={styles.tooltipA} style={{ color: COLOR_A }}>
            {labelA}: {tooltip.magnitudeDbA !== null ? `${tooltip.magnitudeDbA.toFixed(1)} dBFS` : '—'}
          </span>
          <span className={styles.tooltipB} style={{ color: COLOR_B }}>
            {labelB}: {tooltip.magnitudeDbB !== null ? `${tooltip.magnitudeDbB.toFixed(1)} dBFS` : '—'}
          </span>
          {showDelta && (
            <span className={styles.tooltipDelta} style={{ color: COLOR_DELTA }}>
              Δ: {tooltip.deltaDb !== null ? `${tooltip.deltaDb > 0 ? '+' : ''}${tooltip.deltaDb.toFixed(1)} dB` : '—'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
