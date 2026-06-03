import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

interface UseResizableSidebarOptions {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

interface UseResizableSidebarReturn {
  panelWidth: number;
  handleResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  containerRef: RefObject<HTMLDivElement>;
}

export const useResizableSidebar = ({
  initialWidth,
  minWidth = 280,
  maxWidth = 520,
}: UseResizableSidebarOptions): UseResizableSidebarReturn => {
  const [panelWidth, setPanelWidth] = useState(initialWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startWidthRef = useRef(initialWidth);
  const startClientXRef = useRef(0);

  useEffect(() => {
    containerRef.current?.style.setProperty('--resizable-sidebar-width', `${panelWidth}px`);
  }, [panelWidth]);

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    isDraggingRef.current = true;
    startWidthRef.current = panelWidth;
    startClientXRef.current = event.clientX;
  };

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      if (!isDraggingRef.current) return;

      const delta = startClientXRef.current - event.clientX;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      setPanelWidth(nextWidth);
    };

    const handlePointerUp = (): void => {
      isDraggingRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return (): void => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [maxWidth, minWidth]);

  return { panelWidth, handleResizePointerDown, containerRef };
};