import { describe, expect, it } from 'vitest';
import chatReducer, { agentThinkingFinished, chatIsThinkingSelector, userMessageSent } from './chatSlice';

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
});
