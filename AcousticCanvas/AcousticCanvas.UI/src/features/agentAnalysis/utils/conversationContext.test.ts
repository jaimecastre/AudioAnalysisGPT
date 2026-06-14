import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../store/chatSlice';
import { buildRecentConversationContext } from './conversationContext';

describe('buildRecentConversationContext', () => {
  it('keeps recent user and completed assistant turns before the current question', () => {
    const messages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'plot loudness',
        timestamp: '2026-06-14T19:21:00.000Z',
      },
      {
        id: 'plan-1',
        role: 'plan',
        content: '',
        timestamp: '2026-06-14T19:21:01.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Loudness is 8.74 sone.',
        timestamp: '2026-06-14T19:21:03.000Z',
        status: 'completed',
      },
      {
        id: 'user-2',
        role: 'user',
        content: 'and create a graph just for the important area',
        timestamp: '2026-06-14T19:21:10.000Z',
      },
    ];

    const context = buildRecentConversationContext(messages, 'around 1000hz');

    expect(context).toEqual([
      { role: 'user', content: 'plot loudness' },
      { role: 'assistant', content: 'Loudness is 8.74 sone.' },
      { role: 'user', content: 'and create a graph just for the important area' },
      { role: 'user', content: 'around 1000hz' },
    ]);
  });

  it('caps context to the most recent six eligible turns', () => {
    const messages: ChatMessage[] = Array.from({ length: 8 }, (_, index) => ({
      id: `user-${index}`,
      role: 'user',
      content: `turn ${index}`,
      timestamp: '2026-06-14T19:21:00.000Z',
    }));

    const context = buildRecentConversationContext(messages, 'current');

    expect(context.map((turn) => turn.content)).toEqual([
      'turn 3',
      'turn 4',
      'turn 5',
      'turn 6',
      'turn 7',
      'current',
    ]);
  });
});
