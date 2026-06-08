import { useCallback, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { apiClient, HttpMethod } from '../../shared/api/apiClient';
import { useAppDispatch } from '../../store/reduxHooks';
import { cpbCompleted, cpbFailed, cpbStarted } from './cpbSlice';
import type { CpbAnalysis, CpbUserParameters } from './cpbTypes';

interface RunCpbArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: CpbUserParameters;
}

export const useRunCpb = (): { runCpb: (args: RunCpbArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const runCpb = useCallback(async (args: RunCpbArgs): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();
    abortControllerRef.current = abortController;
    dispatch(cpbStarted(requestId));

    try {
      const result = await apiClient.requestJson<CpbAnalysis>(
        API_ENDPOINTS.AUDIO.RUN_CPB,
        {
          method: HttpMethod.POST,
          body: {
            fileId: args.fileId,
            startSeconds: args.startSeconds,
            endSeconds: args.endSeconds,
            bandMode: args.parameters.bandMode,
            fftSize: args.parameters.fftSize,
            overlap: args.parameters.overlap,
            weighting: args.parameters.weighting,
            method: args.parameters.method,
          },
          signal: abortController.signal,
        },
      );
      if (abortController.signal.aborted) return;
      dispatch(cpbCompleted({ requestId, result }));
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'CPB analysis failed';
      dispatch(cpbFailed({ requestId, message }));
    }
  }, [dispatch]);

  return { runCpb };
};
