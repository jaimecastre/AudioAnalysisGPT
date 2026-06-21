import { useState } from 'react';
import { apiClient } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';

export type GenerateReportRequest = {
  fileIds: string[];
  title?: string;
  startSeconds?: number;
  endSeconds?: number;
};

export type GenerateReportResult = {
  title: string;
  markdownContent: string;
  generatedAtUtc: string;
};

export const useGenerateReport = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async (request: GenerateReportRequest): Promise<GenerateReportResult | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await apiClient.requestJson<GenerateReportResult>(API_ENDPOINTS.AUDIO.GENERATE_REPORT, {
        method: 'POST',
        body: request,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateReport, isGenerating, error };
};
