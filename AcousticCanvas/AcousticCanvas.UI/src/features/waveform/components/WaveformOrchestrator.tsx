import type { JSX } from 'react';
import { useAppSelector } from '../../../store/reduxHooks';
import { showWaveformDisplaySelector } from '../store/waveformSelectionSlice';
import { selectedSignalIdSelector } from '../../project/store/projectSlice';
import { WaveSurferDisplay } from './WaveSurferDisplay';
import type { WaveSurferDisplayRef } from './WaveSurferDisplay';
import { useRef } from 'react';

export const WaveformOrchestrator = (): JSX.Element => {
  const showDisplay = useAppSelector(showWaveformDisplaySelector);
  const selectedFileId = useAppSelector(selectedSignalIdSelector);
  const waveSurferRef = useRef<WaveSurferDisplayRef | null>(null);

  if (!showDisplay || !selectedFileId) {
    return null;
  }

  return (
    <WaveSurferDisplay
      fileId={selectedFileId}
      audioUrl=""
      onReady={() => {}}
      onTimeUpdate={() => {}}
      onFinish={() => {}}
      onUserSelectionChange={() => {}}
      displayRef={waveSurferRef}
    />
  );
};
