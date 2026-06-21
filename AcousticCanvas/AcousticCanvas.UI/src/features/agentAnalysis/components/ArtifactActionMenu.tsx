import type { JSX, ReactNode } from 'react';
import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';
import styles from './ArtifactActionMenu.module.scss';

export type ArtifactActionMenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
};

type ArtifactActionMenuProps = {
  label: string;
  actions: ArtifactActionMenuItem[];
  opened?: boolean;
};

export const ArtifactActionMenu = ({
  label,
  actions,
  opened,
}: ArtifactActionMenuProps): JSX.Element => (
  <Menu shadow="md" width={220} position="bottom-end" opened={opened}>
    <Menu.Target>
      <ActionIcon
        aria-label={label}
        className={styles.trigger}
        size="sm"
        variant="subtle"
      >
        <IconDotsVertical size={14} />
      </ActionIcon>
    </Menu.Target>
    <Menu.Dropdown className={styles.dropdown}>
      {actions.map((action) => (
        <Menu.Item
          key={action.id}
          leftSection={action.icon}
          onClick={action.onSelect}
        >
          {action.label}
        </Menu.Item>
      ))}
    </Menu.Dropdown>
  </Menu>
);
