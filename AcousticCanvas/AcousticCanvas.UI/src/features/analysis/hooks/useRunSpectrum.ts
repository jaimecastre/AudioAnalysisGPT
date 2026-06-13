import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import { spectrumStarted, spectrumCompleted, spectrumFailed } from '../store/spectrumSlice';
import type { SpectrumPointsResponse, SpectrumUserParameters } from '../types/spectrumTypes';

interface IRunSpectrumArgs {
  fileId: string;
  startSeconds: number;
  endSeconds: number;
  parameters: SpectrumUserParameters;
}

export const useRunSpectrum = (): { runSpectrum: (args: IRunSpectrumArgs) => Promise<void> } => {
  const dispatch = useAppDispatch();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const runSpectrum = useCallback(async (args: IRunSpectrumArgs): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();
    abortControllerRef.current = abortController;
    dispatch(spectrumStarted(requestId));
    try {
      const isMsgPack = args.parameters.format === 'msgpack';
      const requestFn = isMsgPack
        ? apiClient.requestMsgPack<SpectrumPointsResponse>
        : apiClient.requestJson<SpectrumPointsResponse>;

      const result = await requestFn(
        API_ENDPOINTS.AUDIO.RUN_SPECTRUM,
        {
          method: HttpMethod.POST,
          body: {
            fileId: args.fileId,
            startSeconds: args.startSeconds,
            endSeconds: args.endSeconds,
            fftSize: args.parameters.fftSize,
            overlap: args.parameters.overlap,
            windowType: args.parameters.windowType,
            format: args.parameters.format,
          },
          signal: abortController.signal,
        },
      );
      if (abortController.signal.aborted) return;
      
      console.log('=== Spectrum Points Response (Decompressed) ===');
      console.log('Parameters:', result.parameters);
      console.log('Region:', result.region);
      console.log('Channel count:', result.channels.length);
      
      result.channels.forEach((channel, index) => {
        console.log(`Channel ${index + 1}:`, {
          channelId: channel.channelId,
          channelName: channel.channelName,
          dataPoints: channel.points.length,
          yUnit: channel.yUnit,
          peakFrequencyHz: channel.peakFrequencyHz,
          maxMagnitudeDb: channel.maxMagnitudeDb,
          first5Points: channel.points.slice(0, 5),
          last5Points: channel.points.slice(-5),
        });
      });
      
      console.log('===============================================');
      
      dispatch(spectrumCompleted({ requestId, result }));
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Spectrum analysis failed';
      dispatch(spectrumFailed({ requestId, message }));
    }
  }, [dispatch]);

  return { runSpectrum };
};
