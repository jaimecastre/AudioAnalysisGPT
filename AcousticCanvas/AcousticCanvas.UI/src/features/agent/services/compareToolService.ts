import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { CompareInput, CompareResult } from '../types/agentToolTypes';

export async function callCompareTool(input: CompareInput): Promise<CompareResult> {
  const requestBody = {
    fileIds: input.fileIds,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
  };

  const result = await apiClient.requestJson<CompareResult>(
    API_ENDPOINTS.AUDIO.RUN_COMPARE,
    {
      method: HttpMethod.POST,
      body: requestBody,
    },
  );

  return result;
}
