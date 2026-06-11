import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { AnalyzeInput, AgentAnalysisResult } from '../types/agentToolTypes';

const analysisCache = new Map<string, AgentAnalysisResult>();

function buildAnalyzeCacheKey(input: AnalyzeInput): string {
  const start = input.startSeconds ?? null;
  const end = input.endSeconds ?? null;
  const focus = input.focus ?? null;
  return JSON.stringify({
    kind: input.kind,
    fileId: input.fileId,
    startSeconds: start,
    endSeconds: end,
    focus,
  });
}

export async function callAnalyzeTool(input: AnalyzeInput): Promise<AgentAnalysisResult> {
  const cacheKey = buildAnalyzeCacheKey(input);
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      fromCache: true,
    };
  }

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

  const withDefaults: AgentAnalysisResult = {
    ...result,
    parameters: {
      channelMode: 'mono_sum',
      normalizationMode: 'none',
      ...(result.parameters ?? {}),
      ...(input.kind === 'spectrum'
        ? {
            fftSize: 8192,
            overlap: 0.5,
            windowType: 'hann',
            spectralFocus: input.focus ?? null,
          }
        : {}),
      regionStartSeconds: input.startSeconds,
      regionEndSeconds: input.endSeconds,
    },
    fromCache: false,
  };

  analysisCache.set(cacheKey, withDefaults);
  return withDefaults;
}
