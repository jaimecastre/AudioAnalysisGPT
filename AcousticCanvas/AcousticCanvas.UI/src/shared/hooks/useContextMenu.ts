import { useState, useCallback, useEffect } from 'react';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuOptions {
  disabled?: boolean;
  onClose?: () => void;
}

interface ContextMenuReturn {
  contextMenu: ContextMenuPosition | null;
  openContextMenu: (event: React.MouseEvent) => void;
  closeContextMenu: () => void;
}

export const useContextMenu = (options: ContextMenuOptions = {}): ContextMenuReturn => {
  const { disabled = false, onClose } = options;
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  const openContextMenu = useCallback((event: React.MouseEvent): void => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }, [disabled]);

  const closeContextMenu = useCallback((): void => {
    setContextMenu(null);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleClickOutside = (): void => {
      closeContextMenu();
    };

    if (contextMenu !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClickOutside);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu, closeContextMenu]);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
};
