import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import type { AgentResponseBlock } from '../services/agentAskService';
import { AgentResponseBlockRenderer } from './AgentResponseBlockRenderer';

describe('WorkflowBlockView', () => {
  it('renders generated workflow steps through the shared block renderer', () => {
    const blocks: AgentResponseBlock[] = [
      {
        blockType: 'workflow',
        title: 'Generated analysis workflow',
        question: 'Investigate this recording.',
        steps: [
          {
            stepNumber: 1,
            toolName: 'get_metadata',
            evidenceType: 'metadata',
            fileId: 'file-1',
            fileName: 'fan.wav',
            resultId: null,
            description: 'Check file duration, sample rate, channels, and format metadata.',
          },
          {
            stepNumber: 2,
            toolName: 'run_spectrum',
            evidenceType: 'spectrum',
            fileId: 'file-1',
            fileName: 'fan.wav',
            resultId: 'spectrum_abc',
            description: 'Inspect frequency content, tonal peaks, and spectral balance.',
          },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <MantineProvider>
        <AgentResponseBlockRenderer blocks={blocks} />
      </MantineProvider>,
    );

    expect(markup).toContain('Generated analysis workflow');
    expect(markup).toContain('Investigate this recording.');
    expect(markup).toContain('get_metadata');
    expect(markup).toContain('run_spectrum');
    expect(markup).toContain('fan.wav');
    expect(markup).toContain('spectrum_abc');
  });

  it('renders a fallback instead of crashing when workflow steps are missing', () => {
    const blocks = [
      {
        blockType: 'workflow',
        title: 'Generated analysis workflow',
        question: 'Investigate this recording.',
      },
    ] as unknown as AgentResponseBlock[];

    const markup = renderToStaticMarkup(
      <MantineProvider>
        <AgentResponseBlockRenderer blocks={blocks} />
      </MantineProvider>,
    );

    expect(markup).toContain('Generated analysis workflow');
    expect(markup).toContain('Workflow steps were not included in this response.');
  });
});
