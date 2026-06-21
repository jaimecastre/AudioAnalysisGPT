import { describe, expect, it } from 'vitest';
import { buildReportMarkdownDownload } from './reportDownload';

describe('buildReportMarkdownDownload', () => {
  it('creates a dated markdown filename from the report title and timestamp', () => {
    const download = buildReportMarkdownDownload({
      title: 'Acoustic QA Report',
      markdownContent: '# Acoustic QA Report',
      timestamp: '2026-06-20T20:28:22.000Z',
    });

    expect(download).toEqual({
      filename: 'acoustic-qa-report-2026-06-20.md',
      mimeType: 'text/markdown;charset=utf-8',
      content: '# Acoustic QA Report',
    });
  });

  it('sanitizes title text for safe filenames', () => {
    const download = buildReportMarkdownDownload({
      title: 'QA / Investigation: Fan #1',
      markdownContent: 'content',
      timestamp: '2026-06-20T20:28:22.000Z',
    });

    expect(download.filename).toBe('qa-investigation-fan-1-2026-06-20.md');
  });

  it('falls back to acoustic qa report when title is blank', () => {
    const download = buildReportMarkdownDownload({
      title: '   ',
      markdownContent: 'content',
      timestamp: '2026-06-20T20:28:22.000Z',
    });

    expect(download.filename).toBe('acoustic-qa-report-2026-06-20.md');
  });

  it('adds the selected region to the filename when region bounds are present', () => {
    const download = buildReportMarkdownDownload({
      title: 'Region Report',
      markdownContent: 'content',
      timestamp: '2026-06-20T20:28:22.000Z',
      regionStartSeconds: 0.5,
      regionEndSeconds: 2,
    });

    expect(download.filename).toBe('region-report_0.500s-2.000s-2026-06-20.md');
  });
});
