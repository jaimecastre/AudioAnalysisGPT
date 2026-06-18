import type { AgentAskResponse } from '../../agentAnalysis/services/agentAskService';

export function shouldCreateInvestigationRecord(response: AgentAskResponse): boolean {
  if (response.investigationTrace !== null && response.investigationTrace !== undefined) {
    return true;
  }

  return response.toolExecutions.length > 0;
}
