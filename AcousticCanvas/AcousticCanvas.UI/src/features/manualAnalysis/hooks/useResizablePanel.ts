import { useState, useRef, useEffect } from 'react';

interface IUseResizablePanelReturn {
  panelWidth: number;
  handleDragHandleMouseDown: () => void;
}

export const useResizablePanel = (initialWidth: number): IUseResizablePanelReturn => {
  const [panelWidth, setPanelWidth] = useState(initialWidth);
  const isDraggingRef = useRef(false);

  const handleDragHandleMouseDown = (): void => {
    isDraggingRef.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.max(140, Math.min(400, event.clientX - 200));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = (): void => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return (): void => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return { panelWidth, handleDragHandleMouseDown };
};
