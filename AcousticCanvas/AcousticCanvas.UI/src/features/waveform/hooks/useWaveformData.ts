import { useEffect, useState } from 'react';
import { apiClient } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { WaveformResponse } from '../../audioUpload/services/audioUploadApi';

const WAVEFORM_POINTS = 1000;

export const useWaveformData = (fileId: string): WaveformResponse | null => {
  const [waveformData, setWaveformData] = useState<WaveformResponse | null>(null);

  useEffect(() => {
    if (!fileId) {
      return;
    }

    let cancelled = false;

    apiClient
      .requestJson<WaveformResponse>(API_ENDPOINTS.AUDIO.GET_WAVEFORM(fileId, WAVEFORM_POINTS))
      .then((data) => {
        if (!cancelled) {
          setWaveformData(data);
        }
      })
      .catch(() => {
        // Fetch failed — caller will handle missing data gracefully
      });

    return () => {
      cancelled = true;
      setWaveformData(null);
    };
  }, [fileId]);

  return waveformData;
};
