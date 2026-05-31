import { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import type { WaveformResponse } from '../../audioUpload/audioUploadApi';
import type { WaveSurferDisplayRef } from '../WaveSurferDisplay';

const WAVEFORM_COLOR = '#00b8a9';
const WAVEFORM_PROGRESS_COLOR = '#007a70';
const CURSOR_COLOR = '#e05252';

interface UseWaveSurferOptions {
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
});

const buildDisplayControls = (
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>,
): WaveSurferDisplayRef => ({
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
  // clearSelection is a placeholder; useRegions replaces it after regions are initialized
  clearSelection: () => {},
});

interface UseWaveSurferReturn {
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
}: UseWaveSurferOptions): UseWaveSurferReturn => {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);

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
      setIsReady(false);
    };
  }, [containerRef, audioUrl, height, waveformData, onReady, onTimeUpdate, onFinish]);

  useEffect(() => {
    if (!displayRef) {
      return;
    }

    displayRef.current = buildDisplayControls(wavesurferRef);

    return () => {
      if (displayRef) {
        displayRef.current = null;
      }
    };
  }, [displayRef]);

  return { wavesurferRef, isReady };
};
