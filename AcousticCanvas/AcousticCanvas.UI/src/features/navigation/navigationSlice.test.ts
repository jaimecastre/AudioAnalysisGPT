import { describe, expect, it } from 'vitest';
import navigationReducer, {
  agentPromptPrefillSet,
  agentPromptPrefillCleared,
  agentPromptPrefillSelector,
} from './navigationSlice';

describe('navigationSlice — agentPromptPrefill', () => {
  it('starts as null', () => {
    const state = navigationReducer(undefined, { type: '@@INIT' });
    expect(agentPromptPrefillSelector({ navigation: state })).toBeNull();
  });

  it('sets the prefill string when agentPromptPrefillSet is dispatched', () => {
    const state = navigationReducer(undefined, agentPromptPrefillSet('Explain the spectrum'));
    expect(agentPromptPrefillSelector({ navigation: state })).toBe('Explain the spectrum');
  });

  it('clears the prefill back to null when agentPromptPrefillCleared is dispatched', () => {
    const withPrefill = navigationReducer(undefined, agentPromptPrefillSet('Explain the spectrum'));
    const cleared = navigationReducer(withPrefill, agentPromptPrefillCleared());
    expect(agentPromptPrefillSelector({ navigation: cleared })).toBeNull();
  });
});
