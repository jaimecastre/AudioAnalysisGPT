import { useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import {
  setActiveSelection,
  updateActiveSelection,
  clearActiveSelection,
  activeSelectionSelector,
  loopEnabledSelector,
} from '../waveformSelectionSlice';

const REGION_COLOR = 'rgba(0, 184, 169, 0.25)';
const LOOP_CHECK_EPSILON_SECONDS = 0.05;

interface UseRegionsOptions {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
}

interface UseRegionsReturn {
  regionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>;
  clearSelection: () => void;
}

export const useRegions = ({ wavesurferRef, isReady }: UseRegionsOptions): UseRegionsReturn => {
  const dispatch = useAppDispatch();
  const activeSelection = useAppSelector(activeSelectionSelector);
  const loopEnabled = useAppSelector(loopEnabledSelector);

  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  // Track refs to avoid stale closures in event callbacks
  const activeSelectionRef = useRef(activeSelection);
  const loopEnabledRef = useRef(loopEnabled);

  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  // Get current selection from store for restoration
  const getCurrentSelection = useCallback(() => {
    return activeSelectionRef.current;
  }, []);

  // Set up RegionsPlugin and drag selection once WaveSurfer is ready
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !isReady) {
      return;
    }

    const cleanupFns: Array<() => void> = [];

    // Small timeout to ensure DOM is settled after height changes
    const setupTimeout = setTimeout(() => {
      const regions = RegionsPlugin.create();
      regionsRef.current = regions;
      wavesurfer.registerPlugin(regions);

      // Restore existing selection from Redux state (persists across tab switches)
      const currentSelection = getCurrentSelection();
      if (currentSelection && currentSelection.endSeconds > currentSelection.startSeconds) {
        regions.addRegion({
          start: currentSelection.startSeconds,
          end: currentSelection.endSeconds,
          color: REGION_COLOR,
          drag: true,
          resize: true,
        });
      }

      const disableDragSelection = regions.enableDragSelection({
        color: REGION_COLOR,
      });
      cleanupFns.push(disableDragSelection);

      // When user finishes drawing a new region: remove all previous, store the new one
      const unsubscribeRegionCreated = regions.on('region-created', (region) => {
        const allRegions = regions.getRegions();
        allRegions.forEach((existingRegion) => {
          if (existingRegion.id !== region.id) {
            existingRegion.remove();
          }
        });

        dispatch(setActiveSelection({
          id: region.id,
          startSeconds: region.start,
          endSeconds: region.end,
        }));
      });
      cleanupFns.push(unsubscribeRegionCreated);

      // When user drags or resizes an existing region: sync updated times to state
      const unsubscribeRegionUpdated = regions.on('region-updated', (region) => {
        dispatch(updateActiveSelection({
          startSeconds: region.start,
          endSeconds: region.end,
        }));
      });
      cleanupFns.push(unsubscribeRegionUpdated);

      // Loop logic: on every timeupdate, if loop is on and we are past region end, seek back
      const unsubscribeTimeUpdate = wavesurfer.on('timeupdate', (currentTime: number) => {
        const selection = activeSelectionRef.current;
        const shouldLoop = loopEnabledRef.current;

        if (!shouldLoop || !selection) {
          return;
        }

        const pastRegionEnd = currentTime >= selection.endSeconds - LOOP_CHECK_EPSILON_SECONDS;
        if (pastRegionEnd && wavesurfer.isPlaying()) {
          wavesurfer.setTime(selection.startSeconds);
        }
      });
      cleanupFns.push(unsubscribeTimeUpdate);
    }, 50); // 50ms delay for DOM to settle

    return () => {
      clearTimeout(setupTimeout);
      cleanupFns.forEach(fn => fn());
      regionsRef.current = null;
    };
  }, [wavesurferRef, isReady, dispatch, getCurrentSelection]);

  const clearSelection = (): void => {
    const regions = regionsRef.current;
    if (regions) {
      regions.clearRegions();
    }
    dispatch(clearActiveSelection());
  };

  return { regionsRef, clearSelection };
};
