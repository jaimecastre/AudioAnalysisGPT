import { describe, expect, it } from 'vitest';
import chatReducer, {
  agentThinkingFinished,
  assistantMessageReceived,
  assistantMessageFailed,
  assistantResponseStarted,
  chatIsThinkingSelector,
  planBubbleStarted,
  planBubbleReceived,
  userMessageSent,
} from './chatSlice';

describe('chatSlice', () => {
  it('clears thinking state when the backend agent answer lifecycle finishes', () => {
    const thinkingState = chatReducer(undefined, userMessageSent({
      id: 'user-1',
      content: 'What is in this file?',
      timestamp: '2026-06-08T00:00:00.000Z',
    }));

    const finishedState = chatReducer(thinkingState, agentThinkingFinished());

    expect(chatIsThinkingSelector({ chat: finishedState })).toBe(false);
    expect(finishedState.messages).toHaveLength(1);
  });

  it('appends assistant answers instead of replacing previous answers', () => {
    const firstAnswerState = chatReducer(undefined, assistantMessageReceived({
      id: 'assistant-1',
      content: 'First answer',
      timestamp: '2026-06-08T00:00:00.000Z',
    }));

    const secondAnswerState = chatReducer(firstAnswerState, assistantMessageReceived({
      id: 'assistant-2',
      content: 'Second answer',
      timestamp: '2026-06-08T00:01:00.000Z',
    }));

    expect(secondAnswerState.messages).toHaveLength(2);
    expect(secondAnswerState.messages[0]?.content).toBe('First answer');
    expect(secondAnswerState.messages[1]?.content).toBe('Second answer');
  });

  it('updates the pending assistant response in place when the backend answer completes', () => {
    const userState = chatReducer(undefined, userMessageSent({
      id: 'user-1',
      content: 'Analyze sound quality',
      timestamp: '2026-06-08T00:00:00.000Z',
    }));

    const pendingState = chatReducer(userState, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const completedState = chatReducer(pendingState, assistantMessageReceived({
      id: 'assistant-1',
      content: 'Sound quality analysis complete.',
      timestamp: '2026-06-08T00:00:05.000Z',
    }));

    expect(completedState.messages).toHaveLength(2);
    expect(completedState.messages[1]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Sound quality analysis complete.',
      status: 'completed',
    });
    expect(chatIsThinkingSelector({ chat: completedState })).toBe(false);
  });

  it('updates the pending assistant response in place when the backend answer fails', () => {
    const pendingState = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const failedState = chatReducer(pendingState, assistantMessageFailed({
      id: 'assistant-1',
      error: 'Backend timed out.',
      timestamp: '2026-06-08T00:00:05.000Z',
    }));

    expect(failedState.messages).toHaveLength(1);
    expect(failedState.messages[0]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Backend timed out.',
      status: 'failed',
    });
    expect(chatIsThinkingSelector({ chat: failedState })).toBe(false);
  });

  it('appends a plan bubble message when planBubbleReceived is dispatched', () => {
    const state = chatReducer(undefined, planBubbleReceived({
      id: 'plan-1',
      assistantMessageId: 'assistant-99',
      plannedTools: ['run_basic_metrics', 'run_spectrum'],
      plannerReason: 'Checking levels and spectral peaks.',
      timestamp: '2026-06-08T00:00:02.000Z',
    }));

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      id: 'plan-1',
      role: 'plan',
      plannedTools: ['run_basic_metrics', 'run_spectrum'],
      plannerReason: 'Checking levels and spectral peaks.',
      planStatus: 'done',
    });
  });

  it('planBubbleStarted shows planning state immediately, planBubbleReceived updates it in-place', () => {
    const withAssistant = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const withPlanStarted = chatReducer(withAssistant, planBubbleStarted({
      id: 'plan-1',
      assistantMessageId: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    expect(withPlanStarted.messages[0]).toMatchObject({ role: 'plan', planStatus: 'planning', plannedTools: [] });
    expect(withPlanStarted.messages[1]).toMatchObject({ role: 'assistant' });

    const withPlanDone = chatReducer(withPlanStarted, planBubbleReceived({
      id: 'plan-1',
      assistantMessageId: 'assistant-1',
      plannedTools: ['run_spectrum'],
      plannerReason: null,
      timestamp: '2026-06-08T00:00:05.000Z',
    }));

    // Still 2 messages — updated in-place, not a new entry
    expect(withPlanDone.messages).toHaveLength(2);
    expect(withPlanDone.messages[0]).toMatchObject({ role: 'plan', planStatus: 'done', plannedTools: ['run_spectrum'] });
  });

  it('planBubbleReceived inserts before the assistant message when it exists', () => {
    const withAssistant = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const withPlan = chatReducer(withAssistant, planBubbleReceived({
      id: 'plan-1',
      assistantMessageId: 'assistant-1',
      plannedTools: ['run_spectrum'],
      plannerReason: null,
      timestamp: '2026-06-08T00:00:02.000Z',
    }));

    expect(withPlan.messages).toHaveLength(2);
    expect(withPlan.messages[0]).toMatchObject({ role: 'plan' });
    expect(withPlan.messages[1]).toMatchObject({ role: 'assistant' });
  });

  it('planBubbleReceived with null plannerReason stores null', () => {
    const state = chatReducer(undefined, planBubbleReceived({
      id: 'plan-2',
      assistantMessageId: 'assistant-99',
      plannedTools: ['run_basic_metrics'],
      plannerReason: null,
      timestamp: '2026-06-08T00:00:02.000Z',
    }));

    expect(state.messages[0]).toMatchObject({
      role: 'plan',
      plannerReason: null,
    });
  });
});
