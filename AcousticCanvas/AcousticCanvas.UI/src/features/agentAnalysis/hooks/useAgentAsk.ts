import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store/reduxStore';
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

  async function submitQuestion(question: string, selectedFileIds: string[]) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch(agentAskStarted());

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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error from agent.';
      dispatch(agentAskFailed(errorMessage));
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
