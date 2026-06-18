import { describe, expect, it } from 'vitest';
import type { AgentAskResponse } from '../../agentAnalysis/services/agentAskService';
import { shouldCreateInvestigationRecord } from './investigationRecordDraft';

function makeResponse(overrides: Partial<AgentAskResponse>): AgentAskResponse {
  return {
    conversationId: 'conv-test',
    answer: 'Answer',
    evidencePackageId: '',
    confidence: 'low',
    limitations: [],
    suggestedNextSteps: [],
    toolExecutions: [],
    validationWarning: false,
    toolResultsData: null,
    plannedTools: [],
    plannerReason: null,
    blocks: undefined,
    investigationTrace: null,
    plotHintsMap: null,
    overlayBlocks: null,
    investigationBlocks: null,
    soundQualityComparisonBlocks: null,
    ...overrides,
  };
}

describe('shouldCreateInvestigationRecord', () => {
  it('does not record no-tool fallback responses with no investigation trace', () => {
    const response = makeResponse({
      answer: 'Planner returned an unparseable response. Falling back to no-tool mode.',
    });

    expect(shouldCreateInvestigationRecord(response)).toBe(false);
  });

  it('records responses with tool executions', () => {
    const response = makeResponse({
      toolExecutions: [
        {
          toolName: 'run_basic_metrics',
          status: 'completed',
          resultRef: 'basic_metrics_001',
          errorCode: null,
          errorMessage: null,
        },
      ],
    });

    expect(shouldCreateInvestigationRecord(response)).toBe(true);
  });

  it('records responses with an investigation trace', () => {
    const response = makeResponse({
      investigationTrace: {
        question: 'What is the peak level?',
        conversationId: 'conv-test',
        path: 'deterministic_fact',
        plannedTools: [],
        toolExecutions: [],
        finalAnswer: 'Peak level is 83 dB SPL.',
        confidence: 'high',
        timestampUtc: '2026-06-18T19:25:00.000Z',
        visualizationPlan: null,
      },
    });

    expect(shouldCreateInvestigationRecord(response)).toBe(true);
  });
});
