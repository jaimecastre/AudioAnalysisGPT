import {
  IconArrowRight,
  IconChartLine,
  IconMessage,
  IconClipboard,
  IconBookmark,
  IconBookmarkFilled,
} from '@tabler/icons-react';
import type { ContextMenuItem } from '../../../shared/components/ContextMenu';

interface FindingCardContextMenuProps {
  findingId: string;
  isPinned: boolean;
  onJumpToLocation: () => void;
  onAnalyzeRegion: () => void;
  onAskAgent: () => void;
  onCopyEvidence: () => void;
  onPin: () => void;
  onUnpin: () => void;
}

export const buildFindingCardContextMenuItems = (props: FindingCardContextMenuProps): ContextMenuItem[] => {
  const {
    findingId,
    isPinned,
    onJumpToLocation,
    onAnalyzeRegion,
    onAskAgent,
    onCopyEvidence,
    onPin,
    onUnpin,
  } = props;

  const items: ContextMenuItem[] = [
    {
      id: `jump-${findingId}`,
      label: 'Jump to location',
      icon: <IconArrowRight size={16} />,
      onSelect: onJumpToLocation,
    },
    {
      id: `analyze-${findingId}`,
      label: 'Analyze region',
      icon: <IconChartLine size={16} />,
      onSelect: onAnalyzeRegion,
    },
    {
      id: `ask-agent-${findingId}`,
      label: 'Ask agent about this finding',
      icon: <IconMessage size={16} />,
      onSelect: onAskAgent,
    },
    {
      id: `copy-${findingId}`,
      label: 'Copy evidence',
      icon: <IconClipboard size={16} />,
      onSelect: onCopyEvidence,
    },
    {
      id: `divider-${findingId}`,
      label: '',
      divider: true,
      onSelect: () => {},
    },
    {
      id: isPinned ? `unpin-${findingId}` : `pin-${findingId}`,
      label: isPinned ? 'Unpin finding' : 'Pin finding',
      icon: isPinned ? <IconBookmarkFilled size={16} /> : <IconBookmark size={16} />,
      onSelect: isPinned ? onUnpin : onPin,
    },
  ];

  return items;
};
