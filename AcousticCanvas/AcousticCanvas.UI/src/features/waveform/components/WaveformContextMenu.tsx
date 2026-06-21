import {
  IconChartLine,
  IconSearch,
  IconRepeat,
  IconX,
  IconMapPin,
  IconZoomIn,
  IconZoomOut,
  IconClipboard,
} from '@tabler/icons-react';
import type { ContextMenuItem } from '../../../shared/components/ContextMenu';

interface WaveformContextMenuProps {
  hasSelection: boolean;
  onAnalyzeSelection: () => void;
  onFindEventsInSelection: () => void;
  onSetLoopRegion: () => void;
  onClearSelection: () => void;
  onCopyTimeRange: () => void;
  onAddMarker: () => void;
  onZoomToSelection: () => void;
  onResetZoom: () => void;
}

export const buildWaveformContextMenuItems = (props: WaveformContextMenuProps): ContextMenuItem[] => {
  const {
    hasSelection,
    onAnalyzeSelection,
    onFindEventsInSelection,
    onSetLoopRegion,
    onClearSelection,
    onCopyTimeRange,
    onAddMarker,
    onZoomToSelection,
    onResetZoom,
  } = props;

  const items: ContextMenuItem[] = [];

  if (hasSelection) {
    items.push(
      {
        id: 'analyze-selection',
        label: 'Analyze selection',
        icon: <IconChartLine size={16} />,
        onSelect: onAnalyzeSelection,
      },
      {
        id: 'find-events',
        label: 'Find events in selection',
        icon: <IconSearch size={16} />,
        onSelect: onFindEventsInSelection,
      },
      {
        id: 'set-loop',
        label: 'Set loop region',
        icon: <IconRepeat size={16} />,
        onSelect: onSetLoopRegion,
      },
      {
        id: 'copy-time-range',
        label: 'Copy time range',
        icon: <IconClipboard size={16} />,
        onSelect: onCopyTimeRange,
      },
      {
        id: 'clear-selection',
        label: 'Clear selection',
        icon: <IconX size={16} />,
        onSelect: onClearSelection,
      },
      {
        id: 'selection-divider',
        label: '',
        divider: true,
        onSelect: () => {},
      }
    );
  }

  items.push(
    {
      id: 'add-marker',
      label: 'Add marker at cursor',
      icon: <IconMapPin size={16} />,
      onSelect: onAddMarker,
    }
  );

  if (hasSelection) {
    items.push(
      {
        id: 'zoom-to-selection',
        label: 'Zoom to selection',
        icon: <IconZoomIn size={16} />,
        onSelect: onZoomToSelection,
      }
    );
  }

  items.push(
    {
      id: 'reset-zoom',
      label: 'Reset zoom',
      icon: <IconZoomOut size={16} />,
      onSelect: onResetZoom,
    }
  );

  return items;
};
