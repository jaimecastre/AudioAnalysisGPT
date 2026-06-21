import { describe, expect, it } from 'vitest';
import { buildReportPrintDocument } from './reportPrint';

describe('buildReportPrintDocument', () => {
  it('builds a print-friendly HTML document from report data', () => {
    const html = buildReportPrintDocument({
      title: 'Acoustic QA Report',
      markdownContent: '# Acoustic QA Report\n\n- RMS level: 69.06 dB SPL',
      timestamp: '2026-06-20T20:28:22.000Z',
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Acoustic QA Report</title>');
    expect(html).toContain('<h1>Acoustic QA Report</h1>');
    expect(html).toContain('Generated: 2026-06-20 20:28:22 UTC');
    expect(html).toContain('# Acoustic QA Report\n\n- RMS level: 69.06 dB SPL');
    expect(html).toContain('@media print');
    expect(html).toContain('window.print');
  });

  it('escapes report title and markdown content before writing HTML', () => {
    const html = buildReportPrintDocument({
      title: 'QA <Report>',
      markdownContent: '# Report\n\n<script>alert("x")</script>\n& raw',
      timestamp: '2026-06-20T20:28:22.000Z',
    });

    expect(html).toContain('<title>QA &lt;Report&gt;</title>');
    expect(html).toContain('<h1>QA &lt;Report&gt;</h1>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&amp; raw');
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it('uses a fallback title and generated timestamp when inputs are sparse', () => {
    const html = buildReportPrintDocument({
      title: '  ',
      markdownContent: 'content',
      timestamp: 'not-a-date',
    });

    expect(html).toContain('<title>Acoustic QA Report</title>');
    expect(html).toContain('<h1>Acoustic QA Report</h1>');
    expect(html).toContain('Generated: unavailable');
  });
});
