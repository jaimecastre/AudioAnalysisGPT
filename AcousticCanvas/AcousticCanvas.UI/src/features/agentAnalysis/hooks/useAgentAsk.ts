import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store/reduxStore';
import {
  agentThinkingFinished,
  assistantActivityUpdated,
  assistantMessageFailed,
  assistantMessageReceived,
  assistantResponseStarted,
  planBubbleStarted,
  planBubbleReceived,
  planBubbleRemoved,
} from '../store/chatSlice';
import type { ToolStep } from '../store/chatSlice';
import type { AgentAskResponse, AgentConversationTurn } from '../services/agentAskService';
import { callAgentAskEndpoint } from '../services/agentAskService';
import {
  agentAskStarted,
  agentAskSucceeded,
  agentAskFailed,
  agentAskReset,
  agentAskStatusSelector,
  agentAskResponseSelector,
  agentAskErrorSelector,
} from '../store/agentAskSlice';
import { chatSelectedModelSelector } from '../store/chatSlice';
import { findingsArtifactAdded, toolResultArtifactAdded } from '../store/agentWorkspaceSlice';
import type { FindingItem } from '../store/agentWorkspaceSlice';
import { createToolResultArtifactDrafts } from '../utils/agentToolArtifacts';

const TOOL_TITLES: Record<string, string> = {
  get_metadata: 'Metadata',
  run_basic_metrics: 'Level Metrics',
  run_event_detection: 'Event Detection',
  run_spectrum: 'Spectrum',
  run_spectrogram: 'Spectrogram',
  run_cpb: 'CPB Analysis',
  run_sound_quality_metrics: 'Sound Quality',
};

export function useAgentAsk() {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector(agentAskStatusSelector);
  const response = useSelector(agentAskResponseSelector);
  const error = useSelector(agentAskErrorSelector);
  const selectedModel = useSelector(chatSelectedModelSelector);

  const abortControllerRef = useRef<AbortController | null>(null);

  function buildChatContent(
    agentResponse: AgentAskResponse,
  ): string {
    let content = agentResponse.answer;

    if (agentResponse.suggestedNextSteps.length > 0) {
      content += `\n\nNext steps: ${agentResponse.suggestedNextSteps.join(' ')}`;
    }

    return content;
  }

  async function submitQuestion(
    question: string,
    selectedFileIds: string[],
    conversationContext: AgentConversationTurn[] = [],
  ) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const assistantMessageId = crypto.randomUUID();
    const planBubbleId = crypto.randomUUID();

    dispatch(agentAskStarted());
    dispatch(assistantResponseStarted({
      id: assistantMessageId,
      timestamp: new Date().toISOString(),
    }));
    dispatch(planBubbleStarted({
      id: planBubbleId,
      assistantMessageId,
      timestamp: new Date().toISOString(),
    }));

    try {
      dispatch(assistantActivityUpdated({ id: assistantMessageId, activityLabel: 'running_tools' }));

      const agentResponse = await callAgentAskEndpoint(
        {
          question,
          selectedFileIds,
          conversationContext,
          mode: 'investigate',
          modelOverride: selectedModel,
        },
        abortController.signal,
      );

      dispatch(agentAskSucceeded(agentResponse));
      dispatch(assistantActivityUpdated({ id: assistantMessageId, activityLabel: 'building_results' }));

      if (agentResponse.plannedTools?.length) {
        dispatch(planBubbleReceived({
          id: planBubbleId,
          assistantMessageId,
          plannedTools: agentResponse.plannedTools,
          plannerReason: agentResponse.plannerReason ?? null,
          timestamp: new Date().toISOString(),
        }));
      } else {
        dispatch(planBubbleRemoved({ id: planBubbleId }));
      }

      const artifactTokens: string[] = [];
      const toolData = agentResponse.toolResultsData;

      for (const exec of agentResponse.toolExecutions) {
        if (exec.status !== 'completed' || !exec.resultRef || !toolData) continue;
        const raw = toolData[exec.resultRef];
        if (!raw) continue;

        if (exec.toolName === 'run_findings') {
          const data = raw as { fileId: string; findingCount: number; ranAt: string; findings: FindingItem[] };
          const artifactId = crypto.randomUUID();
          dispatch(findingsArtifactAdded({
            type: 'findings_result',
            id: artifactId,
            timestamp: new Date().toISOString(),
            fileId: data.fileId,
            findingCount: data.findingCount,
            ranAt: data.ranAt,
            findings: data.findings,
          }));
          artifactTokens.push(`[findings_result:${artifactId}]`);
          continue;
        }

        const artifactDrafts = createToolResultArtifactDrafts(exec.toolName, raw);
        for (const artifactDraft of artifactDrafts) {
          const artifactId = crypto.randomUUID();
          dispatch(toolResultArtifactAdded({
            type: 'tool_result',
            id: artifactId,
            timestamp: new Date().toISOString(),
            toolName: artifactDraft.toolName,
            title: TOOL_TITLES[artifactDraft.toolName] ?? artifactDraft.toolName,
            fileId: artifactDraft.fileId,
            rows: artifactDraft.rows,
          }));
          artifactTokens.push(`[tool_result:${artifactId}]`);
        }
      }

      dispatch(assistantActivityUpdated({ id: assistantMessageId, activityLabel: 'generating_answer' }));

      dispatch(assistantMessageReceived({
        id: assistantMessageId,
        content: buildChatContent(agentResponse),
        timestamp: new Date().toISOString(),
        toolSteps: agentResponse.toolExecutions.map((e): ToolStep => ({
          toolName: e.toolName,
          status: e.status,
          errorMessage: e.errorMessage,
        })),
        confidence: agentResponse.confidence,
        limitations: agentResponse.limitations,
        validationWarning: agentResponse.validationWarning,
        plannedTools: agentResponse.plannedTools,
        plannerReason: agentResponse.plannerReason,
        blocks: agentResponse.blocks,
      }));
      dispatch(agentThinkingFinished());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error from agent.';
      dispatch(agentAskFailed(errorMessage));
      dispatch(assistantActivityUpdated({ id: assistantMessageId, activityLabel: 'failed' }));
      dispatch(assistantMessageFailed({
        id: assistantMessageId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  function resetAgentAsk() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    dispatch(agentAskReset());
  }

  const isAnalyzing = status === 'analyzing';

  return {
    status,
    response,
    error,
    isAnalyzing,
    submitQuestion,
    resetAgentAsk,
  };
}
