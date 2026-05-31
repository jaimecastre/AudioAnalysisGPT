import { useAppDispatch } from '../../store/reduxHooks';
import { apiClient, HttpMethod } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { spectrogramStarted, spectrogramCompleted, spectrogramFailed } from './spectrogramSlice';
import type { SpectrogramAnalysis, SpectrogramUserParameters } from './spectrogramTypes';

interface RunSpectrogramArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: SpectrogramUserParameters;
}

export const useRunSpectrogram = (): { runSpectrogram: (args: RunSpectrogramArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();

  const runSpectrogram = async (args: RunSpectrogramArgs): Promise<void> => {
    dispatch(spectrogramStarted());
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
          },
        },
      );
      dispatch(spectrogramCompleted(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Spectrogram analysis failed';
      dispatch(spectrogramFailed(message));
    }
  };

  return { runSpectrogram };
};
