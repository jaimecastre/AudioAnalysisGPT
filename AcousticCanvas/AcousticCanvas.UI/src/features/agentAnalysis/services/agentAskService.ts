import { toFriendlyAgentError } from './agentErrorMessage';

const API_BASE_URL = 'http://localhost:5146';

export type AgentToolExecutionRecord = {
  toolName: string;
  status: 'completed' | 'failed';
  resultRef: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type AgentAskResponse = {
  conversationId: string;
  answer: string;
  evidencePackageId: string;
  evidenceReferences: string[];
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  suggestedNextSteps: string[];
  toolExecutions: AgentToolExecutionRecord[];
  validationWarning: boolean;
  toolResultsData: Record<string, unknown> | null;
  plannedTools: string[];
  plannerReason: string | null;
};

export type AgentAskRequest = {
  question: string;
  selectedFileIds: string[];
  projectId?: string;
  mode?: string;
  modelOverride?: string;
};

export async function callAgentAskEndpoint(
  request: AgentAskRequest,
  signal?: AbortSignal,
): Promise<AgentAskResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agent/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(toFriendlyAgentError(response.status, errorText));
  }

  const data = await response.json() as AgentAskResponse;
  return data;
}
