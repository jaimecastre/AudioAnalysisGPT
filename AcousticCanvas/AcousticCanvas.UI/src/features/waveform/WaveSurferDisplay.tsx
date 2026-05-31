import type { JSX } from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useWaveformData } from './hooks/useWaveformData';
import { useWaveSurfer } from './hooks/useWaveSurfer';
import { useRegions } from './hooks/useRegions';
import { useAppSelector } from '../../store/reduxHooks';
import { activeSelectionSelector } from './waveformSelectionSlice';

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
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onFinish?: () => void;
  displayRef?: React.MutableRefObject<WaveSurferDisplayRef | null>;
}

// Draws the FS y-axis: ticks align with actual waveform peak positions.
// WaveSurfer centers 0 and scales amplitude to fit with padding.
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

  // Calculate y-positions where waveform peaks actually appear
  // WaveSurfer uses ~80% of height for waveform with padding to prevent clipping
  const waveformPadding = 8; // pixels of padding at top/bottom
  const usableHeight = canvasHeight - 2 * waveformPadding;
  const centerY = canvasHeight / 2;

  // Find the max absolute amplitude to determine scaling
  const maxAbsAmplitude = Math.max(Math.abs(globalMaxFs), Math.abs(globalMinFs));

  // Calculate pixel positions where ticks should align with waveform peaks
  // Positive peak position (above center)
  const topY = centerY - (globalMaxFs / maxAbsAmplitude) * (usableHeight / 2);
  // Negative peak position (below center)
  const bottomY = centerY - (globalMinFs / maxAbsAmplitude) * (usableHeight / 2);

  // Top tick — positive peak (+max)
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, topY);
  context.lineTo(lineEndX, topY);
  context.stroke();
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = 'middle';
  context.fillText(`+${globalMaxFs.toFixed(3)}`, tickX, topY);

  // Middle tick — 0 FS (center line, no label)
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, centerY);
  context.lineTo(lineEndX, centerY);
  context.stroke();

  // Bottom tick — negative peak (min)
  context.strokeStyle = AXIS_LINE_COLOR;
  context.beginPath();
  context.moveTo(lineStartX, bottomY);
  context.lineTo(lineEndX, bottomY);
  context.stroke();
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = 'middle';
  context.fillText(`${globalMinFs.toFixed(3)}`, tickX, bottomY);

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
  onReady,
  onTimeUpdate,
  onFinish,
  displayRef,
}: WaveSurferDisplayProps): JSX.Element => {
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement>(null);
  const [containerHeight, setContainerHeight] = useState(200);
  const [hasInteracted, setHasInteracted] = useState(false);

  const activeSelection = useAppSelector(activeSelectionSelector);
  const hasSelection = activeSelection && activeSelection.endSeconds > activeSelection.startSeconds;
  const showHint = !hasInteracted && !hasSelection;

  // Measure container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (waveContainerRef.current) {
        setContainerHeight(waveContainerRef.current.clientHeight);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (waveContainerRef.current?.parentElement) {
      observer.observe(waveContainerRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, []);

  const waveformData = useWaveformData(fileId);

  const { wavesurferRef, isReady } = useWaveSurfer({
    containerRef: waveContainerRef,
    audioUrl,
    height: containerHeight,
    waveformData,
    displayRef,
    onReady,
    onTimeUpdate,
    onFinish,
  });

  const { clearSelection } = useRegions({ wavesurferRef, isReady });

  // Track first interaction to fade the hint
  // Re-attach when container changes (view switches recreate WaveSurfer)
  useEffect(() => {
    const container = waveContainerRef.current;
    if (!container || !isReady) return;

    const handleInteraction = () => {
      setHasInteracted(true);
    };

    container.addEventListener('mousedown', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('mousedown', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [isReady]);

  const redrawAxis = useCallback(() => {
    const canvas = axisCanvasRef.current;
    if (!canvas || !waveformData) {
      return;
    }
    canvas.width = Y_AXIS_WIDTH;
    canvas.height = containerHeight;
    drawFsYAxis(canvas, containerHeight, waveformData.globalMaxFs, waveformData.globalMinFs);
  }, [containerHeight, waveformData]);

  // Update displayRef with clearSelection when regions are ready
  useEffect(() => {
    if (!displayRef?.current) return;
    displayRef.current.clearSelection = clearSelection;
  }, [displayRef, clearSelection]);

  useEffect(() => {
    redrawAxis();
  }, [redrawAxis]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Waveform row: y-axis canvas + waveform */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: containerHeight,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={axisCanvasRef}
          width={Y_AXIS_WIDTH}
          style={{ flexShrink: 0, display: 'block', height: '100%' }}
        />
        <div
          ref={waveContainerRef}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
            backgroundColor: BACKGROUND_COLOR,
            position: 'relative',
          }}
        >
          {showHint && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 184, 169, 0.3)',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '13px',
                color: 'rgba(0, 0, 0, 0.6)',
                fontFamily: FONT_FAMILY,
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              👆 Click and drag to select a region
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
