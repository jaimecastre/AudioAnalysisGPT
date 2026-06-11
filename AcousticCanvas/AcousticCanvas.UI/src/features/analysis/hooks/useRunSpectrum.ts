import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import { spectrumStarted, spectrumCompleted, spectrumFailed } from '../store/spectrumSlice';
import type { SpectrumAnalysis, SpectrumUserParameters } from '../types/spectrumTypes';

interface RunSpectrumArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: SpectrumUserParameters;
}

export const useRunSpectrum = (): { runSpectrum: (args: RunSpectrumArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const runSpectrum = useCallback(async (args: RunSpectrumArgs): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();
    abortControllerRef.current = abortController;
    dispatch(spectrumStarted(requestId));
    try {
      const result = await apiClient.requestJson<SpectrumAnalysis>(
        API_ENDPOINTS.AUDIO.RUN_SPECTRUM,
        {
          method: HttpMethod.POST,
          body: {
            fileId: args.fileId,
            startSeconds: args.startSeconds,
            endSeconds: args.endSeconds,
            fftSize: args.parameters.fftSize,
            overlap: args.parameters.overlap,
          },
          signal: abortController.signal,
        },
      );
      if (abortController.signal.aborted) return;
      dispatch(spectrumCompleted({ requestId, result }));
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Spectrum analysis failed';
      dispatch(spectrumFailed({ requestId, message }));
    }
  }, [dispatch]);

  return { runSpectrum };
};
