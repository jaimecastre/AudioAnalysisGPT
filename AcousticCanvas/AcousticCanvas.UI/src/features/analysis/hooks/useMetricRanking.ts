import { apiClient } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';

export interface MetricRankingRequest {
  fileIds: string[];
  metrics: string[];
}

export interface MetricRankingRow {
  fileId: string;
  fileName: string;
  metricName: string;
  value: number;
  unit: string;
  rank: number;
}

export interface MetricRankingResult {
  rankings: MetricRankingRow[];
}

export const useMetricRanking = () => {
  const runMetricRanking = async (request: MetricRankingRequest): Promise<MetricRankingResult> => {
    return apiClient.requestJson<MetricRankingResult>(API_ENDPOINTS.AUDIO.METRIC_RANKING, {
      method: 'POST',
      body: request,
    });
  };

  return { runMetricRanking };
};
