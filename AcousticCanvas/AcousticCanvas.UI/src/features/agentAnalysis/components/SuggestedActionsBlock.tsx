import type { JSX } from 'react';
import { Button, Group } from '@mantine/core';
import type { SuggestedAction } from '../services/agentAskService';

interface ISuggestedActionsBlockProps {
  actions: SuggestedAction[];
  onActionClick?: (action: SuggestedAction) => void;
}

export function SuggestedActionsBlock({ actions, onActionClick }: ISuggestedActionsBlockProps): JSX.Element {
  if (!actions || actions.length === 0) {
    return <></>;
  }

  return (
    <Group gap="sm" mt="md">
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="light"
          size="compact-sm"
          onClick={() => onActionClick?.(action)}
        >
          {action.label}
        </Button>
      ))}
    </Group>
  );
}
