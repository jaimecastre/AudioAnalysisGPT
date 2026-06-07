import { describe, it, expect } from 'vitest';
import { routeUserQuestion } from './questionRouter';

describe('routeUserQuestion', () => {
  it('routes peak-level questions to the orchestrator', () => {
    expect(routeUserQuestion('what is the peak level?')).toBe('orchestrator');
  });

  it('routes sample-rate questions to the orchestrator', () => {
    expect(routeUserQuestion("what's the sample rate?")).toBe('orchestrator');
  });

  it('routes "how long is the file" duration questions to the orchestrator', () => {
    expect(routeUserQuestion('how long is the file?')).toBe('orchestrator');
  });

  it('routes bit-depth questions to the orchestrator', () => {
    expect(routeUserQuestion('what is the bit depth?')).toBe('orchestrator');
  });

  it('routes mono/stereo questions to the orchestrator', () => {
    expect(routeUserQuestion('is it mono or stereo?')).toBe('orchestrator');
  });

  it('keeps workspace actions in the client-side tool loop', () => {
    expect(routeUserQuestion('add marker here')).toBe('tool_loop');
  });

  it('defaults unrelated chatter to the tool loop', () => {
    expect(routeUserQuestion('hello there')).toBe('tool_loop');
  });
});
