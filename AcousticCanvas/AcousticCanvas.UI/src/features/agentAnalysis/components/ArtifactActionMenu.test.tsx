import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { IconCopy, IconDownload } from '@tabler/icons-react';
import { ArtifactActionMenu } from './ArtifactActionMenu';

describe('ArtifactActionMenu', () => {
  it('renders a labeled menu trigger with menu semantics', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <ArtifactActionMenu
          label="Report actions"
          opened
          actions={[
            {
              id: 'copy',
              label: 'Copy Markdown',
              icon: <IconCopy size={14} />,
              onSelect: () => undefined,
            },
            {
              id: 'download',
              label: 'Download Markdown',
              icon: <IconDownload size={14} />,
              onSelect: () => undefined,
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(markup).toContain('aria-label="Report actions"');
    expect(markup).toContain('aria-haspopup="menu"');
  });
});
