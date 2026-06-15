import { describe, expect, it } from 'vitest';
import chatReducer, {
  agentThinkingFinished,
  assistantActivityUpdated,
  assistantMessageReceived,
  assistantMessageFailed,
  assistantResponseStarted,
  chatIsThinkingSelector,
  planBubbleStarted,
  planBubbleReceived,
  planBubbleRemoved,
  userMessageSent,
} from '../store/chatSlice';

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

  it('stores metadata on completed assistant responses', () => {
    const completedState = chatReducer(undefined, assistantMessageReceived({
      id: 'assistant-1',
      content: 'Peak: -3.2 dBFS.',
      timestamp: '2026-06-08T00:00:05.000Z',
      limitations: ['Only digital clipping was assessed.'],
      validationWarning: true,
      plannerReason: 'A peak-level question only needs basic metrics.',
    }));

    expect(completedState.messages[0]).toMatchObject({
      id: 'assistant-1',
      limitations: ['Only digital clipping was assessed.'],
      validationWarning: true,
      plannerReason: 'A peak-level question only needs basic metrics.',
    });
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

  it('assistantResponseStarted sets activityLabel to planning', () => {
    const state = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      status: 'thinking',
      activityLabel: 'planning',
    });
  });

  it('assistantActivityUpdated progresses through activity labels', () => {
    const pendingState = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const runningState = chatReducer(pendingState, assistantActivityUpdated({
      id: 'assistant-1',
      activityLabel: 'running_tools',
    }));
    expect(runningState.messages[0]?.activityLabel).toBe('running_tools');

    const buildingState = chatReducer(runningState, assistantActivityUpdated({
      id: 'assistant-1',
      activityLabel: 'building_results',
    }));
    expect(buildingState.messages[0]?.activityLabel).toBe('building_results');

    const generatingState = chatReducer(buildingState, assistantActivityUpdated({
      id: 'assistant-1',
      activityLabel: 'generating_answer',
    }));
    expect(generatingState.messages[0]?.activityLabel).toBe('generating_answer');
  });

  it('assistantMessageReceived sets activityLabel to complete', () => {
    const pendingState = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const completedState = chatReducer(pendingState, assistantMessageReceived({
      id: 'assistant-1',
      content: 'Done.',
      timestamp: '2026-06-08T00:00:05.000Z',
    }));

    expect(completedState.messages[0]?.activityLabel).toBe('complete');
  });

  it('assistantMessageFailed sets activityLabel to failed', () => {
    const pendingState = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const failedState = chatReducer(pendingState, assistantMessageFailed({
      id: 'assistant-1',
      error: 'Timeout',
      timestamp: '2026-06-08T00:00:05.000Z',
    }));

    expect(failedState.messages[0]?.activityLabel).toBe('failed');
  });

  it('stores visualizationPlanTrace on a new assistant message', () => {
    const vizPlan = {
      primaryEvidenceType: 'spectrum',
      blocks: [
        { blockType: 'markdown', reason: 'Summarise measured evidence.', viewType: null, sourceEvidenceId: null },
        { blockType: 'analysisView', reason: 'Show spectrum result.', viewType: 'spectrum', sourceEvidenceId: 'ev_spectrum_file1' },
      ],
    };

    const state = chatReducer(undefined, assistantMessageReceived({
      id: 'assistant-1',
      content: 'Spectrum analysis complete.',
      timestamp: '2026-06-15T00:00:05.000Z',
      visualizationPlanTrace: vizPlan,
    }));

    expect(state.messages[0]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      status: 'completed',
      visualizationPlanTrace: {
        primaryEvidenceType: 'spectrum',
        blocks: expect.arrayContaining([
          expect.objectContaining({ blockType: 'analysisView', viewType: 'spectrum' }),
        ]),
      },
    });
  });

  it('updates visualizationPlanTrace in-place on a pending assistant message', () => {
    const vizPlan = {
      primaryEvidenceType: 'cpb',
      blocks: [
        { blockType: 'markdown', reason: 'Summarise.', viewType: null, sourceEvidenceId: null },
        { blockType: 'analysisView', reason: 'Show CPB.', viewType: 'cpb', sourceEvidenceId: 'ev_cpb_file1' },
      ],
    };

    const pendingState = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-15T00:00:01.000Z',
    }));

    const completedState = chatReducer(pendingState, assistantMessageReceived({
      id: 'assistant-1',
      content: 'CPB complete.',
      timestamp: '2026-06-15T00:00:05.000Z',
      visualizationPlanTrace: vizPlan,
    }));

    expect(completedState.messages).toHaveLength(1);
    expect(completedState.messages[0]?.visualizationPlanTrace?.primaryEvidenceType).toBe('cpb');
    const analysisBlock = completedState.messages[0]?.visualizationPlanTrace?.blocks.find(
      (b) => b.blockType === 'analysisView',
    );
    expect(analysisBlock?.viewType).toBe('cpb');
    expect(analysisBlock?.reason).toBeTruthy();
  });

  it('stores null visualizationPlanTrace when not provided by the agent response', () => {
    const state = chatReducer(undefined, assistantMessageReceived({
      id: 'assistant-1',
      content: 'What is a spectrogram? A spectrogram plots frequency over time.',
      timestamp: '2026-06-15T00:00:05.000Z',
      visualizationPlanTrace: null,
    }));

    expect(state.messages[0]?.visualizationPlanTrace).toBeNull();
  });

  it('stores the full block reason text on each visualization plan block', () => {
    const vizPlan = {
      primaryEvidenceType: 'sound_quality',
      blocks: [
        { blockType: 'markdown', reason: 'Use text to summarize measured evidence and limitations.', viewType: null, sourceEvidenceId: null },
        { blockType: 'ranking', reason: 'Compare multiple files with a ranking block before the narrative so differences can be scanned quickly.', viewType: null, sourceEvidenceId: 'ev_sq_fileA' },
        { blockType: 'analysisView', reason: 'Show the soundQuality result in the trusted analysis view so the user can inspect measured data and metadata.', viewType: 'soundQuality', sourceEvidenceId: 'ev_sq_fileA' },
      ],
    };

    const state = chatReducer(undefined, assistantMessageReceived({
      id: 'assistant-1',
      content: 'Sound quality compared.',
      timestamp: '2026-06-15T00:00:05.000Z',
      visualizationPlanTrace: vizPlan,
    }));

    const blocks = state.messages[0]?.visualizationPlanTrace?.blocks ?? [];
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      expect(block.reason.length).toBeGreaterThan(0);
    }
  });

  it('planBubbleRemoved removes a no-tool planning bubble without removing the assistant response', () => {
    const withAssistant = chatReducer(undefined, assistantResponseStarted({
      id: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const withPlanStarted = chatReducer(withAssistant, planBubbleStarted({
      id: 'plan-1',
      assistantMessageId: 'assistant-1',
      timestamp: '2026-06-08T00:00:01.000Z',
    }));

    const withoutPlan = chatReducer(withPlanStarted, planBubbleRemoved({ id: 'plan-1' }));

    expect(withoutPlan.messages).toHaveLength(1);
    expect(withoutPlan.messages[0]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
    });
  });
});
