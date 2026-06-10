import { useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { agentArtifactsSelector, expandedArtifactIdsSelector, focusedArtifactIdSelector, artifactFocusCleared } from '../agentWorkspaceSlice';

export function useArtifactFeed() {
  const artifacts = useAppSelector(agentArtifactsSelector);
  const focusedArtifactId = useAppSelector(focusedArtifactIdSelector);
  const dispatch = useAppDispatch();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const artifactRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [artifacts]);

  useEffect(() => {
    if (!focusedArtifactId) return;
    const artifactEl = artifactRefs.current[focusedArtifactId];
    if (!artifactEl) return;
    artifactEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => {
      dispatch(artifactFocusCleared());
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dispatch, focusedArtifactId]);

  return {
    artifacts,
    focusedArtifactId,
    feedRef,
    artifactRefs,
  };
}

export function useArtifactExpanded(artifactId: string): boolean {
  const expandedArtifactIds = useAppSelector(expandedArtifactIdsSelector);
  return expandedArtifactIds.includes(artifactId);
}
