import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  isEnabled: boolean;
  onPlayPause: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onAddMarker?: () => void;
  onClearSelection: () => void;
}

const SEEK_STEP_SECONDS = 0.1;

export const useKeyboardShortcuts = ({
  isEnabled,
  onPlayPause,
  onSeekBackward,
  onSeekForward,
  onAddMarker,
  onClearSelection,
}: KeyboardShortcutsOptions): void => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled) {
        return;
      }

      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping) {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onSeekBackward();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onSeekForward();
          break;
        case 'm':
        case 'M':
          if (onAddMarker) {
            event.preventDefault();
            onAddMarker();
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClearSelection();
          break;
      }
    },
    [isEnabled, onPlayPause, onSeekBackward, onSeekForward, onAddMarker, onClearSelection],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export { SEEK_STEP_SECONDS };
