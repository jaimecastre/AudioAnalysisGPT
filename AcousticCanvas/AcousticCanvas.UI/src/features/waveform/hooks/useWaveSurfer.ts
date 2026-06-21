import { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import type { WaveformResponse } from '../../audioUpload/services/audioUploadApi';
import type { WaveSurferDisplayRef } from '../components/WaveSurferDisplay';

const WAVEFORM_COLOR = '#00b8a9';
const WAVEFORM_PROGRESS_COLOR = '#007a70';
const CURSOR_COLOR = '#e05252';

interface IUseWaveSurferOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  audioUrl: string;
  height: number;
  waveformData: WaveformResponse | null;
  displayRef?: React.MutableRefObject<WaveSurferDisplayRef | null>;
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onFinish?: () => void;
}

const buildWaveSurferConfig = (
  container: HTMLDivElement,
  height: number,
  audioUrl: string,
  waveformData: WaveformResponse,
): ConstructorParameters<typeof WaveSurfer>[0] => ({
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
  interact: true,
});


interface IUseWaveSurferReturn {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
}

export const useWaveSurfer = ({
  containerRef,
  audioUrl,
  height,
  waveformData,
  displayRef,
  onReady,
  onTimeUpdate,
  onFinish,
}: IUseWaveSurferOptions): IUseWaveSurferReturn => {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const appliedHeightRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const onReadyRef = useRef(onReady);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onFinishRef = useRef(onFinish);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !audioUrl || !waveformData) {
      return;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    setIsReady(false);

    const config = buildWaveSurferConfig(container, height, audioUrl, waveformData);
    const wavesurfer = WaveSurfer.create(config);
    wavesurferRef.current = wavesurfer;

    wavesurfer.on('ready', () => {
      setIsReady(true);
      onReadyRef.current?.(waveformData.durationSeconds);
    });

    wavesurfer.on('timeupdate', (time: number) => {
      onTimeUpdateRef.current?.(time);
    });

    wavesurfer.on('finish', () => {
      onFinishRef.current?.();
    });

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
      appliedHeightRef.current = null;
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, audioUrl, waveformData]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !isReady) {
      return;
    }
    if (appliedHeightRef.current === height) {
      return;
    }
    appliedHeightRef.current = height;
    wavesurfer.setOptions({ height });
  }, [height, isReady]);

  useEffect(() => {
    if (!displayRef) {
      return;
    }

    displayRef.current = {
      play: () => wavesurferRef.current?.play(),
      pause: () => wavesurferRef.current?.pause(),
      seek: (timeSeconds: number) => {
        const duration = wavesurferRef.current?.getDuration() ?? 0;
        if (duration > 0) {
          wavesurferRef.current?.seekTo(timeSeconds / duration);
        }
      },
      getTimeForClientX: (clientX: number) => {
        const container = containerRef.current;
        const wavesurfer = wavesurferRef.current;
        const duration = wavesurfer?.getDuration() ?? 0;
        if (!container || !wavesurfer || duration <= 0) {
          return null;
        }

        const bounds = container.getBoundingClientRect();
        if (bounds.width <= 0) {
          return null;
        }

        const localX = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
        const scrollLeft = wavesurfer.getScroll();

        // Read actual rendered canvas width from WaveSurfer's shadow DOM scroll container.
        // This is accurate at any zoom level; the estimation via getWidth() drifts when zoomed.
        const shadowRoot = (wavesurfer as unknown as { renderer?: { scrollContainer?: HTMLElement } }).renderer?.scrollContainer;
        const renderedWidth = shadowRoot?.scrollWidth ?? (scrollLeft + bounds.width);

        const timeFraction = Math.max(0, Math.min(1, (localX + scrollLeft) / renderedWidth));
        return timeFraction * duration;
      },
      clearSelection: () => { /* patched by WaveSurferDisplay once regions are ready */ },
      setSelection: () => { /* patched by WaveSurferDisplay once regions are ready */ },
      zoomToSelection: (startSeconds: number, endSeconds: number) => {
        const container = containerRef.current;
        const wavesurfer = wavesurferRef.current;
        const duration = wavesurfer?.getDuration() ?? 0;
        const selectionDuration = endSeconds - startSeconds;
        if (!container || !wavesurfer || duration <= 0 || selectionDuration <= 0) {
          return;
        }

        const targetVisibleSeconds = Math.min(duration, selectionDuration * 1.15);
        const minPxPerSec = Math.max(container.clientWidth / targetVisibleSeconds, container.clientWidth / duration);
        wavesurfer.zoom(minPxPerSec);
        wavesurfer.setScrollTime(Math.max(0, startSeconds - selectionDuration * 0.075));
      },
      resetZoom: () => {
        const wavesurfer = wavesurferRef.current;
        if (!wavesurfer) {
          return;
        }
        wavesurfer.zoom(0);
        wavesurfer.setScroll(0);
      },
    };

    return () => {
      displayRef.current = null;
    };
  }, [containerRef, displayRef]);

  return { wavesurferRef, isReady };
};
