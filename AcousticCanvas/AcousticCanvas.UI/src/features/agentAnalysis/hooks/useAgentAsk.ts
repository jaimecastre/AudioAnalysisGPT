import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store/reduxStore';
import {
  agentThinkingFinished,
  assistantMessageFailed,
  assistantMessageReceived,
  assistantResponseStarted,
} from '../chatSlice';
import type { AgentAskResponse } from '../services/agentAskService';
import { callAgentAskEndpoint } from '../services/agentAskService';
import {
  agentAskStarted,
  agentAskSucceeded,
  agentAskFailed,
  agentAskReset,
  agentAskStatusSelector,
  agentAskResponseSelector,
  agentAskErrorSelector,
} from '../agentAskSlice';

export function useAgentAsk() {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector(agentAskStatusSelector);
  const response = useSelector(agentAskResponseSelector);
  const error = useSelector(agentAskErrorSelector);

  const abortControllerRef = useRef<AbortController | null>(null);

  function formatAgentResponseForChat(agentResponse: AgentAskResponse): string {
    const sections = [agentResponse.answer];

    if (agentResponse.suggestedNextSteps.length > 0) {
      sections.push(`Next steps: ${agentResponse.suggestedNextSteps.join(' ')}`);
    }

    return sections.join('\n\n');
  }

  async function submitQuestion(question: string, selectedFileIds: string[]) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const assistantMessageId = crypto.randomUUID();

    dispatch(agentAskStarted());
    dispatch(assistantResponseStarted({
      id: assistantMessageId,
      timestamp: new Date().toISOString(),
    }));

    try {
      const agentResponse = await callAgentAskEndpoint(
        {
          question,
          selectedFileIds,
          mode: 'investigate',
        },
        abortController.signal,
      );

      dispatch(agentAskSucceeded(agentResponse));
      dispatch(assistantMessageReceived({
        id: assistantMessageId,
        content: formatAgentResponseForChat(agentResponse),
        timestamp: new Date().toISOString(),
      }));
      dispatch(agentThinkingFinished());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error from agent.';
      dispatch(agentAskFailed(errorMessage));
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
