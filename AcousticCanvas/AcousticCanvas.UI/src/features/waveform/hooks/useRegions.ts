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
} from '../store/waveformSelectionSlice';

const REGION_COLOR = 'rgba(0, 184, 169, 0.25)';
const LOOP_CHECK_EPSILON_SECONDS = 0.05;

function formatRegionTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function buildRegionLabelElement(startSeconds: number, endSeconds: number): HTMLElement {
  const durationSeconds = endSeconds - startSeconds;
  const container = document.createElement('div');
  container.style.cssText = [
    'position: absolute',
    'top: 4px',
    'left: 4px',
    'right: 4px',
    'display: flex',
    'justify-content: space-between',
    'pointer-events: none',
    'z-index: 10',
  ].join(';');

  const labelStyle = [
    'font-size: 9px',
    "font-family: 'JetBrains Mono', ui-monospace, monospace",
    'color: rgba(0, 100, 90, 0.9)',
    'background: rgba(255, 255, 255, 0.75)',
    'padding: 1px 4px',
    'border-radius: 3px',
    'white-space: nowrap',
  ].join(';');

  const startLabel = document.createElement('span');
  startLabel.style.cssText = labelStyle;
  startLabel.textContent = formatRegionTime(startSeconds);

  const durationLabel = document.createElement('span');
  durationLabel.style.cssText = labelStyle;
  durationLabel.textContent = `${durationSeconds.toFixed(3)}s`;

  const endLabel = document.createElement('span');
  endLabel.style.cssText = labelStyle;
  endLabel.textContent = formatRegionTime(endSeconds);

  container.appendChild(startLabel);
  container.appendChild(durationLabel);
  container.appendChild(endLabel);
  return container;
}

interface UseRegionsOptions {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  onUserSelectionChange?: (startSeconds: number, endSeconds: number) => void;
}

interface UseRegionsReturn {
  regionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>;
  clearSelection: () => void;
  setSelectionInWaveSurfer: (startSeconds: number, endSeconds: number) => void;
}

export const useRegions = ({ wavesurferRef, isReady, onUserSelectionChange }: UseRegionsOptions): UseRegionsReturn => {
  const dispatch = useAppDispatch();
  const activeSelection = useAppSelector(activeSelectionSelector);
  const loopEnabled = useAppSelector(loopEnabledSelector);

  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  // Track refs to avoid stale closures in event callbacks
  const activeSelectionRef = useRef(activeSelection);
  const loopEnabledRef = useRef(loopEnabled);
  const onUserSelectionChangeRef = useRef(onUserSelectionChange);

  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  useEffect(() => {
    onUserSelectionChangeRef.current = onUserSelectionChange;
  }, [onUserSelectionChange]);

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

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;
    wavesurfer.registerPlugin(regions);

    const disableDragSelection = regions.enableDragSelection({
      color: REGION_COLOR,
    });

    let isCancelled = false;
    const currentSelection = getCurrentSelection();
    if (currentSelection && currentSelection.endSeconds > currentSelection.startSeconds) {
      requestAnimationFrame(() => {
        if (isCancelled) return;
        if (!wavesurferRef.current) return;
        try {
          regions.addRegion({
            start: currentSelection.startSeconds,
            end: currentSelection.endSeconds,
            color: REGION_COLOR,
            drag: true,
            resize: true,
            content: buildRegionLabelElement(currentSelection.startSeconds, currentSelection.endSeconds),
          });
        } catch {
          // WaveSurfer was destroyed — safe to ignore
        }
      });
    }

    // When user finishes drawing a new region: remove all previous, store the new one
    const unsubscribeRegionCreated = regions.on('region-created', (region) => {
      const allRegions = regions.getRegions();
      allRegions.forEach((existingRegion) => {
        if (existingRegion.id !== region.id) {
          existingRegion.remove();
        }
      });

      region.setOptions({ content: buildRegionLabelElement(region.start, region.end) });

      onUserSelectionChangeRef.current?.(region.start, region.end);
      dispatch(setActiveSelection({
        id: region.id,
        startSeconds: region.start,
        endSeconds: region.end,
      }));
    });

    // When user drags or resizes an existing region: sync updated times to state
    const unsubscribeRegionUpdated = regions.on('region-updated', (region) => {
      region.setOptions({ content: buildRegionLabelElement(region.start, region.end) });
      onUserSelectionChangeRef.current?.(region.start, region.end);
      dispatch(updateActiveSelection({
        startSeconds: region.start,
        endSeconds: region.end,
      }));
    });

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

    return () => {
      isCancelled = true;
      disableDragSelection();
      unsubscribeRegionCreated();
      unsubscribeRegionUpdated();
      unsubscribeTimeUpdate();
      regionsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, dispatch, getCurrentSelection]);

  const setSelectionInWaveSurfer = useCallback((startSeconds: number, endSeconds: number): void => {
    const regions = regionsRef.current;
    const wavesurfer = wavesurferRef.current;
    if (!regions || !wavesurfer) return;
    try {
      regions.clearRegions();
      regions.addRegion({
        start: startSeconds,
        end: endSeconds,
        color: REGION_COLOR,
        drag: true,
        resize: true,
        content: buildRegionLabelElement(startSeconds, endSeconds),
      });
    } catch {
      // WaveSurfer was destroyed — safe to ignore
    }
  }, [wavesurferRef]);

  const clearSelection = (): void => {
    const regions = regionsRef.current;
    if (regions) {
      regions.clearRegions();
    }
    dispatch(clearActiveSelection());
  };

  return { regionsRef, clearSelection, setSelectionInWaveSurfer };
};
