import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import { spectrogramStarted, spectrogramCompleted, spectrogramFailed } from '../store/spectrogramSlice';
import type { SpectrogramAnalysis, SpectrogramUserParameters } from '../types/spectrogramTypes';

interface RunSpectrogramArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: SpectrogramUserParameters;
}

export const useRunSpectrogram = (): { runSpectrogram: (args: RunSpectrogramArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const runSpectrogram = useCallback(async (args: RunSpectrogramArgs): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();
    abortControllerRef.current = abortController;
    dispatch(spectrogramStarted(requestId));
    try {
      const result = await apiClient.requestJson<SpectrogramAnalysis>(
        API_ENDPOINTS.AUDIO.RUN_SPECTROGRAM,
        {
          method: HttpMethod.POST,
          body: {
            fileId: args.fileId,
            startSeconds: args.startSeconds,
            endSeconds: args.endSeconds,
            fftSize: args.parameters.fftSize,
            overlap: args.parameters.overlap,
            scale: args.parameters.scale,
            gainDb: args.parameters.gainDb,
            rangeDb: args.parameters.rangeDb,
            minDbSpl: args.parameters.minDbSpl,
            maxDbSpl: args.parameters.maxDbSpl,
          },
          signal: abortController.signal,
        },
      );
      if (abortController.signal.aborted) return;
      dispatch(spectrogramCompleted({ requestId, result }));
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Spectrogram analysis failed';
      dispatch(spectrogramFailed({ requestId, message }));
    }
  }, [dispatch]);

  return { runSpectrogram };
};
