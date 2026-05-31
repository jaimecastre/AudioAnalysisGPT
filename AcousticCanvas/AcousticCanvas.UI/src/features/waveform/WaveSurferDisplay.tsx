import type { JSX } from 'react';
import { useRef, useEffect, useCallback } from 'react';
import { useWaveformData } from './hooks/useWaveformData';
import { useWaveSurfer } from './hooks/useWaveSurfer';
import { useRegions } from './hooks/useRegions';

// Y-axis layout constants
const Y_AXIS_WIDTH = 72;
const FONT_SIZE = 10;
const FONT_FAMILY = "'JetBrains Mono', ui-monospace, Consolas, monospace";

// App color tokens
const BACKGROUND_COLOR = '#ffffff';
const AXIS_LINE_COLOR = 'rgba(0,0,0,0.15)';
const LABEL_COLOR = 'rgba(0,0,0,0.5)';
const UNIT_LABEL_COLOR = 'rgba(0,0,0,0.3)';

export interface WaveSurferDisplayRef {
  play: () => void;
  pause: () => void;
  seek: (timeSeconds: number) => void;
  clearSelection: () => void;
}

interface WaveSurferDisplayProps {
  fileId: string;
  audioUrl: string;
  height?: number;
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onFinish?: () => void;
  displayRef?: React.MutableRefObject<WaveSurferDisplayRef | null>;
}

// Draws the FS y-axis: globalMaxFs at top, 0 FS in the middle, globalMinFs at bottom.
// Ticks are pinned to actual canvas edges since WaveSurfer fills the full height.
function drawFsYAxis(
  canvas: HTMLCanvasElement,
  canvasHeight: number,
  globalMaxFs: number,
  globalMinFs: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const canvasWidth = Y_AXIS_WIDTH;
  context.clearRect(0, 0, canvasWidth, canvasHeight);

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  context.textAlign = 'right';
  context.lineWidth = 1;

  const tickX = canvasWidth - 4;
  const lineEndX = canvasWidth;
  const lineStartX = canvasWidth - 6;

  // Top tick — globalMaxFs
  const topY = 10;
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, topY);
  context.lineTo(lineEndX, topY);
  context.stroke();
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = 'top';
  context.fillText(`+${globalMaxFs.toFixed(3)}`, tickX, topY + 1);

  // Middle tick — 0 FS
  const middleY = canvasHeight / 2;
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, middleY);
  context.lineTo(lineEndX, middleY);
  context.stroke();
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = 'middle';
  context.fillText('0', tickX, middleY);

  // Bottom tick — globalMinFs
  const bottomY = canvasHeight - 10;
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, bottomY);
  context.lineTo(lineEndX, bottomY);
  context.stroke();
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = 'bottom';
  context.fillText(`${globalMinFs.toFixed(3)}`, tickX, bottomY - 1);

  // Vertical axis line
  context.strokeStyle = AXIS_LINE_COLOR;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(canvasWidth, 0);
  context.lineTo(canvasWidth, canvasHeight);
  context.stroke();

  // Rotated "FS" unit label
  context.save();
  context.translate(FONT_SIZE + 2, canvasHeight / 2);
  context.rotate(-Math.PI / 2);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = UNIT_LABEL_COLOR;
  context.fillText('FS', 0, 0);
  context.restore();
}

export const WaveSurferDisplay = ({
  fileId,
  audioUrl,
  height = 120,
  onReady,
  onTimeUpdate,
  onFinish,
  displayRef,
}: WaveSurferDisplayProps): JSX.Element => {
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement>(null);

  const waveformData = useWaveformData(fileId);

  const { wavesurferRef, isReady } = useWaveSurfer({
    containerRef: waveContainerRef,
    audioUrl,
    height,
    waveformData,
    displayRef,
    onReady,
    onTimeUpdate,
    onFinish,
  });

  const { clearSelection } = useRegions({ wavesurferRef, isReady });

  useEffect(() => {
    if (!displayRef) {
      return;
    }
    const existingControls = displayRef.current;
    if (existingControls) {
      displayRef.current = { ...existingControls, clearSelection };
    }
  }, [displayRef, clearSelection]);

  const redrawAxis = useCallback(() => {
    const canvas = axisCanvasRef.current;
    if (!canvas || !waveformData) {
      return;
    }
    canvas.width = Y_AXIS_WIDTH;
    canvas.height = height;
    drawFsYAxis(canvas, height, waveformData.globalMaxFs, waveformData.globalMinFs);
  }, [height, waveformData]);

  useEffect(() => {
    redrawAxis();
  }, [redrawAxis]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: `${height}px`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={axisCanvasRef}
        width={Y_AXIS_WIDTH}
        height={height}
        style={{ flexShrink: 0, display: 'block' }}
      />
      <div
        ref={waveContainerRef}
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          backgroundColor: BACKGROUND_COLOR,
        }}
      />
    </div>
  );
};
