import { apiClient } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';

export interface SoundQualitySummaryRequest {
  fileId: string;
}

export interface TopMetric {
  name: string;
  value: number;
  unit: string;
  assessment: string;
}

export interface SoundQualitySummaryResult {
  fileId: string;
  fileName: string;
  overallAssessment: string;
  keyFindings: string[];
  topMetrics: TopMetric[];
  recommendations: string[];
}

export const useSoundQualitySummary = () => {
  const runSoundQualitySummary = async (request: SoundQualitySummaryRequest): Promise<SoundQualitySummaryResult> => {
    return apiClient.requestJson<SoundQualitySummaryResult>(API_ENDPOINTS.AUDIO.SOUND_QUALITY_SUMMARY, {
      method: 'POST',
      body: request,
    });
  };

  return { runSoundQualitySummary };
};
