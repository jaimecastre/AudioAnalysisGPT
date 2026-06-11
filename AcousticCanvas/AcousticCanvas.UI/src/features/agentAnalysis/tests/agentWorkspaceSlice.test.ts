import { describe, expect, it } from 'vitest';
import agentWorkspaceReducer, {
  artifactFocusCleared,
  artifactFocused,
  expandedArtifactIdsSelector,
  focusedArtifactIdSelector,
} from '../store/agentWorkspaceSlice';

describe('agentWorkspaceSlice', () => {
  it('keeps an artifact expanded after transient focus is cleared', () => {
    const focusedState = agentWorkspaceReducer(undefined, artifactFocused('artifact-1'));

    expect(focusedArtifactIdSelector({ agentWorkspace: focusedState })).toBe('artifact-1');
    expect(expandedArtifactIdsSelector({ agentWorkspace: focusedState })).toEqual(['artifact-1']);

    const clearedState = agentWorkspaceReducer(focusedState, artifactFocusCleared());

    expect(focusedArtifactIdSelector({ agentWorkspace: clearedState })).toBeNull();
    expect(expandedArtifactIdsSelector({ agentWorkspace: clearedState })).toEqual(['artifact-1']);
  });
});
