import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { FindInput, FindEventsResult } from '../types/agentToolTypes';

export async function callFindTool(input: FindInput): Promise<FindEventsResult> {
  const requestBody = {
    fileId: input.fileId,
    kind: input.kind,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
  };

  const result = await apiClient.requestJson<FindEventsResult>(
    API_ENDPOINTS.AUDIO.RUN_FIND,
    {
      method: HttpMethod.POST,
      body: requestBody,
    },
  );

  return result;
}
