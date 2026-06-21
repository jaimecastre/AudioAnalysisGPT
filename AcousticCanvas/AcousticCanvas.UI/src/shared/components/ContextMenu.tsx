import type { JSX, ReactNode } from 'react';
import { Paper, Text, Portal } from '@mantine/core';

export type ContextMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  onSelect: () => void;
};

interface ContextMenuProps {
  opened: boolean;
  position: { x: number; y: number } | null;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu = ({ opened, position, items, onClose }: ContextMenuProps): JSX.Element => {
  if (!opened || !position) {
    return <></>;
  }

  // Calculate adjusted position to prevent menu from being cropped
  const menuWidth = 200;
  const menuHeight = items.length * 40; // Approximate height
  const padding = 8;

  let adjustedX = position.x;
  let adjustedY = position.y;

  // Check if menu would go off right edge
  if (adjustedX + menuWidth > window.innerWidth - padding) {
    adjustedX = window.innerWidth - menuWidth - padding;
  }

  // Check if menu would go off bottom edge
  if (adjustedY + menuHeight > window.innerHeight - padding) {
    adjustedY = window.innerHeight - menuHeight - padding;
  }

  // Ensure menu doesn't go off left or top edge
  adjustedX = Math.max(padding, adjustedX);
  adjustedY = Math.max(padding, adjustedY);

  return (
    <Portal>
      <Paper
        shadow="md"
        withBorder
        p={0}
        style={{
          position: 'fixed',
          left: adjustedX,
          top: adjustedY,
          zIndex: 9999,
          minWidth: 200,
          maxWidth: 300,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={`divider-${index}`}
                style={{
                  height: 1,
                  backgroundColor: 'var(--mantine-color-gray-3)',
                  margin: '4px 0',
                }}
              />
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => {
                if (!item.disabled) {
                  item.onSelect();
                  onClose();
                }
              }}
              style={{
                padding: '8px 12px',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: item.danger ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-9)',
                opacity: item.disabled ? 0.5 : 1,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
              <Text size="sm">{item.label}</Text>
            </div>
          );
        })}
      </Paper>
    </Portal>
  );
};
