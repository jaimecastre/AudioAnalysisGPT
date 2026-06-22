import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../store/chatSlice';
import { buildInvestigationReportMarkdown } from '../utils/investigationReportSerializer';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: 'This is the agent answer.',
    timestamp: '2026-06-22T10:00:00.000Z',
    status: 'completed',
    ...overrides,
  };
}

describe('buildInvestigationReportMarkdown', () => {
  it('starts with the report title as an H1 heading', () => {
    const result = buildInvestigationReportMarkdown(makeMessage(), { title: 'My Investigation' });
    expect(result).toMatch(/^# My Investigation/);
  });

  it('includes a generated timestamp line', () => {
    const result = buildInvestigationReportMarkdown(makeMessage(), { title: 'Report' });
    expect(result).toContain('Generated:');
  });

  it('includes the user question when provided', () => {
    const result = buildInvestigationReportMarkdown(makeMessage(), {
      title: 'Report',
      userQuestion: 'Which file sounds worse?',
    });
    expect(result).toContain('Which file sounds worse?');
  });

  it('includes the agent answer text', () => {
    const result = buildInvestigationReportMarkdown(
      makeMessage({ content: 'File B sounds worse due to higher sharpness.' }),
      { title: 'Report' },
    );
    expect(result).toContain('File B sounds worse due to higher sharpness.');
  });

  it('serializes a workflow block as an ordered Investigation Workflow section', () => {
    const message = makeMessage({
      blocks: [
        {
          blockType: 'workflow',
          title: 'Investigation Workflow',
          question: 'Which file is louder?',
          steps: [
            { stepNumber: 1, toolName: 'run_basic_metrics', evidenceType: 'basic_metrics', fileId: 'f1', fileName: 'file-a.wav', resultId: 'r1', description: 'Measured RMS and peak levels' },
            { stepNumber: 2, toolName: 'run_spectrum', evidenceType: 'spectrum', fileId: 'f1', fileName: 'file-a.wav', resultId: 'r2', description: 'Computed FFT spectrum' },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Investigation Workflow');
    expect(result).toContain('1. run_basic_metrics');
    expect(result).toContain('Measured RMS and peak levels');
    expect(result).toContain('file-a.wav');
    expect(result).toContain('2. run_spectrum');
  });

  it('serializes a statistics block as a markdown table', () => {
    const message = makeMessage({
      blocks: [
        {
          blockType: 'statistics',
          title: 'Level Summary',
          rows: [
            { label: 'RMS', value: '-18.2', unit: 'dBFS' },
            { label: 'Peak', value: '-3.1', unit: 'dBFS' },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Level Summary');
    expect(result).toContain('| Metric | Value |');
    expect(result).toContain('| RMS | -18.2 dBFS |');
    expect(result).toContain('| Peak | -3.1 dBFS |');
  });

  it('serializes a ranking block as a numbered list', () => {
    const message = makeMessage({
      blocks: [
        {
          blockType: 'ranking',
          title: 'Files by Loudness',
          metricName: 'loudness',
          rankedItems: [
            { rank: 1, fileId: 'f1', fileName: 'loud.wav', score: 42.5, scoreLabel: '42.5', scoreUnit: 'sone' },
            { rank: 2, fileId: 'f2', fileName: 'quiet.wav', score: 18.1, scoreLabel: '18.1', scoreUnit: 'sone' },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Files by Loudness');
    expect(result).toContain('1. loud.wav — 42.5 sone');
    expect(result).toContain('2. quiet.wav — 18.1 sone');
  });

  it('serializes suggestedActions block as a bulleted list', () => {
    const message = makeMessage({
      blocks: [
        {
          blockType: 'suggestedActions',
          actions: [
            { label: 'Run spectrogram', actionType: 'tool', toolName: 'run_spectrogram' },
            { label: 'Compare with reference', actionType: 'prompt', promptText: 'Compare with reference file' },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Suggested Next Steps');
    expect(result).toContain('- Run spectrogram');
    expect(result).toContain('- Compare with reference');
  });

  it('serializes soundQualityComparisonBlocks as a table', () => {
    const message = makeMessage({
      soundQualityComparisonBlocks: [
        {
          blockType: 'soundQualityComparison',
          title: 'Sound Quality',
          signals: [
            { fileId: 'f1', fileName: 'product-a.wav', loudnessSone: 42.3, sharpnessAcum: 1.8, roughnessAsper: 0.4 },
            { fileId: 'f2', fileName: 'product-b.wav', loudnessSone: 38.1, sharpnessAcum: 2.1, roughnessAsper: 0.6 },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Sound Quality Comparison');
    expect(result).toContain('| File | Loudness (sone) | Sharpness (acum) | Roughness (asper) |');
    expect(result).toContain('| product-a.wav | 42.3 | 1.8 | 0.4 |');
    expect(result).toContain('| product-b.wav | 38.1 | 2.1 | 0.6 |');
  });

  it('serializes overlayBlocks as a Spectrum Comparison table', () => {
    const message = makeMessage({
      overlayBlocks: [
        {
          blockType: 'spectrumOverlay',
          title: 'Spectrum Overlay',
          signals: [
            { resultId: 'r1', fileId: 'f1', fileName: 'a.wav', plotHints: { focusFrequencyHz: 1000, annotationLabel: 'peak at 1 kHz' } },
            { resultId: 'r2', fileId: 'f2', fileName: 'b.wav', plotHints: null },
          ],
          sharedPlotHints: null,
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Spectrum Comparison');
    expect(result).toContain('| File | Focus Frequency | Annotation |');
    expect(result).toContain('| a.wav | 1000 Hz | peak at 1 kHz |');
    expect(result).toContain('| b.wav | — | — |');
  });

  it('serializes investigationBlocks as a Multi-Signal Investigation table', () => {
    const message = makeMessage({
      investigationBlocks: [
        {
          blockType: 'investigation',
          diagnosticQuestion: 'Why does it sound harsh?',
          signals: [
            { resultId: 'r1', fileId: 'f1', fileName: 'a.wav', viewType: 'spectrum', plotHints: { focusFrequencyHz: 4000 } },
            { resultId: 'r2', fileId: 'f1', fileName: 'a.wav', viewType: 'soundQuality', plotHints: null },
          ],
        },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Multi-Signal Investigation');
    expect(result).toContain('| File | Analysis Type | Focus Frequency |');
    expect(result).toContain('| a.wav | spectrum | 4000 Hz |');
    expect(result).toContain('| a.wav | soundQuality | — |');
  });

  it('includes an Analysis Methods section from toolSteps', () => {
    const message = makeMessage({
      toolSteps: [
        { toolName: 'run_basic_metrics', status: 'completed' },
        { toolName: 'run_spectrum', status: 'completed' },
        { toolName: 'run_sound_quality_metrics', status: 'failed' },
      ],
    });
    const result = buildInvestigationReportMarkdown(message, { title: 'Report' });
    expect(result).toContain('## Analysis Methods');
    expect(result).toContain('run_basic_metrics');
    expect(result).toContain('run_spectrum');
    // Only completed steps listed
    expect(result).not.toContain('run_sound_quality_metrics');
  });

  it('includes confidence when present', () => {
    const result = buildInvestigationReportMarkdown(
      makeMessage({ confidence: 'high' }),
      { title: 'Report' },
    );
    expect(result).toContain('**Confidence:** high');
  });

  it('includes a Limitations section when limitations are present', () => {
    const result = buildInvestigationReportMarkdown(
      makeMessage({ limitations: ['Calibration not verified.', 'Only one file analyzed.'] }),
      { title: 'Report' },
    );
    expect(result).toContain('## Limitations');
    expect(result).toContain('- Calibration not verified.');
    expect(result).toContain('- Only one file analyzed.');
  });

  it('handles a message with no blocks or extra data gracefully', () => {
    const result = buildInvestigationReportMarkdown(makeMessage(), { title: 'Minimal Report' });
    expect(result).toContain('# Minimal Report');
    expect(result).toContain('This is the agent answer.');
    // Should not throw or include empty section headers
    expect(result).not.toContain('## Investigation Workflow');
    expect(result).not.toContain('## Analysis Methods');
  });
});
