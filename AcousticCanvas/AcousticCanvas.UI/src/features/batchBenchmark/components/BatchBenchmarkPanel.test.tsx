import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { store } from '../../../store/reduxStore';
import { BatchBenchmarkPanel } from './BatchBenchmarkPanel';

describe('BatchBenchmarkPanel', () => {
  it('shows a prominent in-panel loading status while benchmark is loading', () => {
    const markup = renderToStaticMarkup(
      <Provider store={store}>
        <MantineProvider>
          <BatchBenchmarkPanel
            result={null}
            status="loading"
            error={null}
            onClose={() => undefined}
            onRerun={() => undefined}
          />
        </MantineProvider>
      </Provider>,
    );

    expect(markup).toContain('Benchmarking files');
    expect(markup).toContain('Ranking files, detecting outliers, and preparing benchmark metrics.');
    expect(markup).toContain('role="status"');
  });
});
