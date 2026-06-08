import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { ApiError, apiClient, HttpMethod } from '../../shared/api/apiClient';
import type { SoundQualityAnalysis } from './soundQualityTypes';

interface RunSoundQualityArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
}

export const useRunSoundQuality = (): {
  result: SoundQualityAnalysis | null;
  isRunning: boolean;
  error: string | null;
  runSoundQuality: (args: RunSoundQualityArgs) => Promise<void>;
  resetSoundQuality: () => void;
} => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [result, setResult] = useState<SoundQualityAnalysis | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const runSoundQuality = useCallback(async (args: RunSoundQualityArgs): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const analysis = await apiClient.requestJson<SoundQualityAnalysis>(
        API_ENDPOINTS.AUDIO.RUN_SOUND_QUALITY,
        {
          method: HttpMethod.POST,
          body: {
            fileId: args.fileId,
            startSeconds: args.startSeconds,
            endSeconds: args.endSeconds,
            method: 'mosqito_stationary_zwicker',
          },
          signal: abortController.signal,
        },
      );
      if (abortController.signal.aborted) return;
      setResult(analysis);
    } catch (requestError) {
      if (abortController.signal.aborted) return;
      const responseBody = requestError instanceof ApiError
        ? await requestError.response?.text().catch(() => null)
        : null;
      const message = responseBody && responseBody.trim().length > 0
        ? responseBody
        : requestError instanceof Error ? requestError.message : 'Sound-quality analysis failed';
      setError(message);
    } finally {
      if (!abortController.signal.aborted) {
        setIsRunning(false);
      }
    }
  }, []);

  const resetSoundQuality = useCallback((): void => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setResult(null);
    setIsRunning(false);
    setError(null);
  }, []);

  return { result, isRunning, error, runSoundQuality, resetSoundQuality };
};
