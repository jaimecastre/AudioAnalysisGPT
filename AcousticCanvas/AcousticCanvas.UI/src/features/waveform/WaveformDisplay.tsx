import type { JSX } from 'react';
import { useRef, useEffect, useState } from 'react';
import { useWaveformCanvas } from './useWaveformCanvas';
import type { WaveformBin } from '../audioUpload/audioUploadApi';
import styles from './WaveformDisplay.module.scss';

interface WaveformDisplayProps {
  waveformBins: WaveformBin[];
  amplitudeUnit: string;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export const WaveformDisplay = ({
  waveformBins,
  amplitudeUnit,
  height = 160,
  color = '#00d9c8',
  backgroundColor = '#1a1d29',
}: WaveformDisplayProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(Math.floor(container.getBoundingClientRect().width));

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const { canvasRef } = useWaveformCanvas({
    waveformBins,
    amplitudeUnit,
    width: containerWidth,
    height,
    color,
    backgroundColor,
  });

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        width={containerWidth}
        height={height}
        className={styles.canvas}
        style={{
          width: `${containerWidth}px`,
          height: `${height}px`,
        }}
      />
    </div>
  );
};
