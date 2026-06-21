import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManualWorkflowLoadingPanel } from './ManualWorkflowLoadingPanel';

describe('ManualWorkflowLoadingPanel', () => {
  it('renders an accessible workflow status message', () => {
    const markup = renderToStaticMarkup(
      <ManualWorkflowLoadingPanel
        title="Comparing files"
        description="Building A/B spectrum, band energy, and sound-quality deltas."
      />,
    );

    expect(markup).toContain('Comparing files');
    expect(markup).toContain('Building A/B spectrum, band energy, and sound-quality deltas.');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});
