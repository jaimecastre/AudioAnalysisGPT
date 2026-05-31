import { useAppDispatch } from '../../store/reduxHooks';
import { apiClient, HttpMethod } from '../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../shared/api/apiEndpoints';
import { spectrumStarted, spectrumCompleted, spectrumFailed } from './spectrumSlice';
import type { SpectrumAnalysis, SpectrumUserParameters } from './spectrumTypes';

interface RunSpectrumArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: SpectrumUserParameters;
}

export const useRunSpectrum = (): { runSpectrum: (args: RunSpectrumArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();

  const runSpectrum = async (args: RunSpectrumArgs): Promise<void> => {
    dispatch(spectrumStarted());
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
        },
      );
      dispatch(spectrumCompleted(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Spectrum analysis failed';
      dispatch(spectrumFailed(message));
    }
  };

  return { runSpectrum };
};
