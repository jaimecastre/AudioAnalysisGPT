import type { JSX } from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { apiClient } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import type { WaveformResponse } from '../audioUpload/audioUploadApi';

// Y-axis layout constants
const Y_AXIS_WIDTH = 72;
const FONT_SIZE = 10;
const FONT_FAMILY = "'JetBrains Mono', ui-monospace, Consolas, monospace";

// App color tokens
const WAVEFORM_COLOR = '#00b8a9';
const WAVEFORM_PROGRESS_COLOR = '#007a70';
const CURSOR_COLOR = '#e05252';
const BACKGROUND_COLOR = '#ffffff';
const AXIS_LINE_COLOR = 'rgba(0,0,0,0.15)';
const LABEL_COLOR = 'rgba(0,0,0,0.5)';
const UNIT_LABEL_COLOR = 'rgba(0,0,0,0.3)';

export interface WaveSurferDisplayRef {
  play: () => void;
  pause: () => void;
  seek: (timeSeconds: number) => void;
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
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [waveformData, setWaveformData] = useState<WaveformResponse | null>(null);

  // Fetch precomputed FS peaks from the backend
  useEffect(() => {
    if (!fileId) {
      return;
    }

    let cancelled = false;

    apiClient
      .requestJson<WaveformResponse>(API_ENDPOINTS.AUDIO.GET_WAVEFORM(fileId, 1000))
      .then((data) => {
        if (!cancelled) {
          setWaveformData(data);
        }
      })
      .catch(() => {
        // Waveform fetch failed — WaveSurfer will decode audio directly as fallback
      });

    return () => {
      cancelled = true;
      setWaveformData(null);
    };
  }, [fileId]);

  // Redraw the canvas y-axis whenever waveform data or height changes
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

  // Create WaveSurfer instance when waveform data is ready
  useEffect(() => {
    const container = waveContainerRef.current;
    if (!container || !audioUrl || !waveformData) {
      return;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    // Pass precomputed peaks so WaveSurfer skips audio decoding for rendering.
    // normalize: false preserves the real FS amplitude values.
    // Peaks format: one channel array [min0, max0, min1, max1, ...]
    const wavesurfer = WaveSurfer.create({
      container,
      height,
      waveColor: WAVEFORM_COLOR,
      progressColor: WAVEFORM_PROGRESS_COLOR,
      cursorColor: CURSOR_COLOR,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: false,
      peaks: [waveformData.peaks],
      duration: waveformData.durationSeconds,
      url: audioUrl,
    });

    wavesurferRef.current = wavesurfer;

    wavesurfer.on('ready', () => {
      onReady?.(waveformData.durationSeconds);
    });

    wavesurfer.on('timeupdate', (time: number) => {
      onTimeUpdate?.(time);
    });

    wavesurfer.on('finish', () => {
      onFinish?.();
    });

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, height, waveformData, onReady, onTimeUpdate, onFinish]);

  // Expose play/pause/seek controls via ref
  useEffect(() => {
    if (!displayRef) {
      return;
    }

    displayRef.current = {
      play: () => {
        wavesurferRef.current?.play();
      },
      pause: () => {
        wavesurferRef.current?.pause();
      },
      seek: (timeSeconds: number) => {
        const duration = wavesurferRef.current?.getDuration() ?? 0;
        if (duration > 0) {
          wavesurferRef.current?.seekTo(timeSeconds / duration);
        }
      },
    };

    return () => {
      if (displayRef) {
        displayRef.current = null;
      }
    };
  }, [displayRef]);

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
