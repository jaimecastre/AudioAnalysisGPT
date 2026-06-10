import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { BatchBenchmarkRequest, BatchBenchmarkResult } from '../batchBenchmarkTypes';

export async function callBatchBenchmarkTool(input: BatchBenchmarkRequest): Promise<BatchBenchmarkResult> {
  const requestBody = {
    fileIds: input.fileIds,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
    includeSoundQuality: input.includeSoundQuality ?? true,
  };

  return apiClient.requestJson<BatchBenchmarkResult>(
    API_ENDPOINTS.AUDIO.RUN_BATCH_BENCHMARK,
    {
      method: HttpMethod.POST,
      body: requestBody,
    },
  );
}
