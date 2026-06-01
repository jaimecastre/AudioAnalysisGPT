import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { AnalyzeInput, AgentAnalysisResult } from '../agentToolTypes';

export async function callAnalyzeTool(input: AnalyzeInput): Promise<AgentAnalysisResult> {
  const requestBody = {
    fileId: input.fileId,
    kind: input.kind,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
  };

  const result = await apiClient.requestJson<AgentAnalysisResult>(
    API_ENDPOINTS.AUDIO.RUN_AGENT_ANALYSIS,
    {
      method: HttpMethod.POST,
      body: requestBody,
    },
  );

  return result;
}
