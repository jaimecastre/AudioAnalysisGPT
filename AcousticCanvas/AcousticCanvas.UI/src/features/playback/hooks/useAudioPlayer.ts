import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  play: () => void;
  pause: () => void;
  seek: (timeSeconds: number) => void;
  loadFile: (fileUrl: string) => void;
  unloadFile: () => void;
}

export const useAudioPlayer = (): UseAudioPlayerReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const updateTimeRef = useRef<() => void>(() => {});

  const updateTimeSmoothly = useCallback(() => {
    if (!isPlayingRef.current || !audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    animationFrameRef.current = requestAnimationFrame(() => updateTimeRef.current());
  }, []);

  useEffect(() => {
    updateTimeRef.current = updateTimeSmoothly;
  }, [updateTimeSmoothly]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(() => updateTimeRef.current());
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadStart = () => setIsLoading(true);

    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.pause();
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioRef.current = null;
    };
  }, []);

  const loadFile = useCallback((fileUrl: string): void => {
    if (!audioRef.current) return;
    audioRef.current.src = fileUrl;
    audioRef.current.load();
  }, []);

  const play = useCallback((): void => {
    audioRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback((): void => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((timeSeconds: number): void => {
    if (!audioRef.current) return;
    const clampedTime = Math.max(0, Math.min(timeSeconds, duration));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  const unloadFile = useCallback((): void => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.src = '';
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(false);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    isLoading,
    play,
    pause,
    seek,
    loadFile,
    unloadFile,
  };
};
