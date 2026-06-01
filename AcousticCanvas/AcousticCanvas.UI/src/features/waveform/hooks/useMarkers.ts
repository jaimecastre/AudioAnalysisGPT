import { useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { markersSelector, removeMarker } from '../../project/projectSlice';
import type { Marker } from '../../../store/projectState';

const MARKER_COLOR = 'rgba(224, 82, 82, 0.9)';
const DELETE_BUTTON_SIZE = 14;

function formatMarkerTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function buildMarkerContent(
  marker: Marker,
  onDelete: (markerId: string) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = [
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'position: relative',
  ].join(';');

  const labelContainer = document.createElement('div');
  labelContainer.style.cssText = [
    'position: absolute',
    'bottom: 8px',
    'left: 50%',
    'transform: translateX(-50%)',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'gap: 4px',
    'pointer-events: auto',
  ].join(';');

  const deleteButton = document.createElement('button');
  deleteButton.textContent = '×';
  deleteButton.style.cssText = [
    `width: ${DELETE_BUTTON_SIZE}px`,
    `height: ${DELETE_BUTTON_SIZE}px`,
    'border-radius: 50%',
    'border: none',
    'background: rgba(224, 82, 82, 0.9)',
    'color: white',
    'font-size: 10px',
    'line-height: 1',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 0',
    'margin-bottom: 2px',
  ].join(';');
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    onDelete(marker.id);
  });

  const label = document.createElement('span');
  label.textContent = marker.label;
  label.style.cssText = [
    'font-size: 10px',
    "font-family: 'JetBrains Mono', ui-monospace, monospace",
    'color: rgba(0, 0, 0, 0.7)',
    'background: rgba(255, 255, 255, 0.9)',
    'padding: 2px 6px',
    'border-radius: 4px',
    'white-space: nowrap',
    'max-width: 120px',
    'overflow: hidden',
    'text-overflow: ellipsis',
  ].join(';');

  const timeLabel = document.createElement('span');
  timeLabel.textContent = formatMarkerTime(marker.timeSeconds);
  timeLabel.style.cssText = [
    'font-size: 9px',
    "font-family: 'JetBrains Mono', ui-monospace, monospace",
    'color: rgba(0, 0, 0, 0.5)',
    'background: rgba(255, 255, 255, 0.8)',
    'padding: 1px 4px',
    'border-radius: 3px',
  ].join(';');

  labelContainer.appendChild(deleteButton);
  labelContainer.appendChild(label);
  labelContainer.appendChild(timeLabel);
  container.appendChild(labelContainer);

  return container;
}

interface UseMarkersOptions {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  fileId: string;
  onMarkerClick?: (timeSeconds: number) => void;
}

interface UseMarkersReturn {
  markerRegionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>;
}

export const useMarkers = ({
  wavesurferRef,
  isReady,
  fileId,
  onMarkerClick,
}: UseMarkersOptions): UseMarkersReturn => {
  const dispatch = useAppDispatch();
  const allMarkers = useAppSelector(markersSelector);

  const markerRegionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);

  const fileMarkers = allMarkers.filter((marker) => marker.fileId === fileId);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  const handleDeleteMarker = useCallback((markerId: string) => {
    dispatch(removeMarker(markerId));
  }, [dispatch]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !isReady) {
      return;
    }

    const regions = RegionsPlugin.create();
    markerRegionsRef.current = regions;
    wavesurfer.registerPlugin(regions);

    const renderedMarkers: Map<string, { region: ReturnType<typeof regions.addRegion>, unsubscribe: () => void }> = new Map();

    function renderMarker(marker: Marker): void {
      const region = regions.addRegion({
        start: marker.timeSeconds,
        end: marker.timeSeconds + 0.01,
        color: MARKER_COLOR,
        drag: false,
        resize: false,
        content: buildMarkerContent(marker, handleDeleteMarker),
      });

      const unsubscribeClick = region.on('click', () => {
        onMarkerClickRef.current?.(marker.timeSeconds);
      });

      renderedMarkers.set(marker.id, { region, unsubscribe: unsubscribeClick });
    }

    function clearAllMarkers(): void {
      for (const { region, unsubscribe } of renderedMarkers.values()) {
        unsubscribe();
        region.remove();
      }
      renderedMarkers.clear();
    }

    function syncMarkers(): void {
      const currentMarkerIds = new Set(fileMarkers.map((marker) => marker.id));

      for (const [markerId, { region, unsubscribe }] of renderedMarkers) {
        if (!currentMarkerIds.has(markerId)) {
          unsubscribe();
          region.remove();
          renderedMarkers.delete(markerId);
        }
      }

      for (const marker of fileMarkers) {
        if (!renderedMarkers.has(marker.id)) {
          renderMarker(marker);
        }
      }
    }

    syncMarkers();

    return () => {
      clearAllMarkers();
      markerRegionsRef.current = null;
    };
  }, [isReady, fileId, fileMarkers, handleDeleteMarker, wavesurferRef]);

  return { markerRegionsRef };
};
