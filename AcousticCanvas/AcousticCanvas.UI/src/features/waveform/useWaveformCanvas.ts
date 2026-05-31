import { useRef, useEffect } from 'react';
import type { WaveformBin } from '../audioUpload/audioUploadApi';
import { drawWaveformCanvas } from './waveformCanvasUtils';

interface UseWaveformCanvasOptions {
  waveformBins: WaveformBin[];
  width: number;
  height: number;
  color: string;
  backgroundColor: string;
  amplitudeUnit: string;
}

interface UseWaveformCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useWaveformCanvas(options: UseWaveformCanvasOptions): UseWaveformCanvasReturn {
  const { waveformBins, width, height, color, backgroundColor, amplitudeUnit } = options;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    drawWaveformCanvas({
      context,
      waveformBins,
      width,
      height,
      color,
      backgroundColor,
      amplitudeUnit,
    });
  }, [waveformBins, width, height, color, backgroundColor, amplitudeUnit]);

  return { canvasRef };
}
