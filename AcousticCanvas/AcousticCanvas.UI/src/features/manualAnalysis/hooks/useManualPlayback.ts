import { useState, useRef, useEffect } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { removeAudioFile, setSelectedSignal } from '../../project/store/projectSlice';
import { analysisClear } from '../../analysis/store/analysisSlice';
import { useRunAnalysis } from '../../analysis/hooks/useRunAnalysis';
import type { WaveSurferDisplayRef } from '../../waveform/components/WaveSurferDisplay';

interface UseManualPlaybackReturn {
  waveSurferRef: React.RefObject<WaveSurferDisplayRef | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  handleWaveSurferReady: (audioDuration: number) => void;
  handleWaveSurferTimeUpdate: (time: number) => void;
  handleWaveSurferFinish: () => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleSeek: (timeSeconds: number) => void;
  handleSelectFile: (fileId: string) => void;
  handleRemoveFile: (fileId: string) => void;
}

export const useManualPlayback = (selectedSignalId: string | null): UseManualPlaybackReturn => {
  const dispatch = useAppDispatch();
  const { runAnalysis } = useRunAnalysis();

  const waveSurferRef = useRef<WaveSurferDisplayRef | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (selectedSignalId) {
      runAnalysis(selectedSignalId);
    }
  }, [selectedSignalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWaveSurferReady = (audioDuration: number): void => {
    setDuration(audioDuration);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleWaveSurferTimeUpdate = (time: number): void => {
    setCurrentTime(time);
  };

  const handleWaveSurferFinish = (): void => {
    setIsPlaying(false);
  };

  const handlePlay = (): void => {
    waveSurferRef.current?.play();
    setIsPlaying(true);
  };

  const handlePause = (): void => {
    waveSurferRef.current?.pause();
    setIsPlaying(false);
  };

  const handleSeek = (timeSeconds: number): void => {
    waveSurferRef.current?.seek(timeSeconds);
    setCurrentTime(timeSeconds);
  };

  const handleSelectFile = (fileId: string): void => {
    if (fileId === selectedSignalId) return;
    waveSurferRef.current?.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    dispatch(setSelectedSignal(fileId));
  };

  const handleRemoveFile = (fileId: string): void => {
    if (fileId === selectedSignalId) {
      waveSurferRef.current?.pause();
      waveSurferRef.current?.clearSelection();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      dispatch(analysisClear());
    }
    dispatch(removeAudioFile(fileId));
  };

  return {
    waveSurferRef,
    isPlaying,
    currentTime,
    duration,
    handleWaveSurferReady,
    handleWaveSurferTimeUpdate,
    handleWaveSurferFinish,
    handlePlay,
    handlePause,
    handleSeek,
    handleSelectFile,
    handleRemoveFile,
  };
};
