import {
  IconCheck,
  IconGitCompare,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-react';
import type { ContextMenuItem } from '../../../shared/components/ContextMenu';

interface FileListContextMenuProps {
  fileId: string;
  isSelected: boolean;
  canCompare: boolean;
  onSelectFile: () => void;
  onCompareWith: () => void;
  onShowFileInfo: () => void;
  onRemoveFile: () => void;
}

export const buildFileListContextMenuItems = (props: FileListContextMenuProps): ContextMenuItem[] => {
  const {
    fileId,
    isSelected,
    canCompare,
    onSelectFile,
    onCompareWith,
    onShowFileInfo,
    onRemoveFile,
  } = props;

  const items: ContextMenuItem[] = [];

  if (!isSelected) {
    items.push({
      id: `select-${fileId}`,
      label: 'Set as active file',
      icon: <IconCheck size={16} />,
      onSelect: onSelectFile,
    });
  }

  if (canCompare) {
    items.push({
      id: `compare-${fileId}`,
      label: 'Compare with...',
      icon: <IconGitCompare size={16} />,
      onSelect: onCompareWith,
    });
  }

  items.push({
    id: `info-${fileId}`,
    label: 'Show file info',
    icon: <IconInfoCircle size={16} />,
    onSelect: onShowFileInfo,
  });

  items.push({
    id: `divider-${fileId}`,
    label: '',
    divider: true,
    onSelect: () => {},
  });

  items.push({
    id: `remove-${fileId}`,
    label: 'Remove file',
    icon: <IconTrash size={16} />,
    danger: true,
    onSelect: onRemoveFile,
  });

  return items;
};
