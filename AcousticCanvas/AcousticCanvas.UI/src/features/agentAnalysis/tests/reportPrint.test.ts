import { describe, expect, it } from 'vitest';
import { buildMarkdownAsHtml, buildInvestigationPrintDocument } from '../utils/reportPrint';

describe('buildMarkdownAsHtml', () => {
  it('converts H1 heading to <h1>', () => {
    expect(buildMarkdownAsHtml('# My Title')).toContain('<h1>My Title</h1>');
  });

  it('converts H2 heading to <h2>', () => {
    expect(buildMarkdownAsHtml('## Section')).toContain('<h2>Section</h2>');
  });

  it('converts H3 heading to <h3>', () => {
    expect(buildMarkdownAsHtml('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('converts table rows to a <table>', () => {
    const md = '| Name | Value |\n|------|-------|\n| RMS | -18 dBFS |';
    const html = buildMarkdownAsHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<th>Value</th>');
    expect(html).toContain('<td>RMS</td>');
    expect(html).toContain('<td>-18 dBFS</td>');
    expect(html).toContain('</table>');
  });

  it('converts unordered list items to <ul><li>', () => {
    const md = '- Item one\n- Item two';
    const html = buildMarkdownAsHtml(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item one</li>');
    expect(html).toContain('<li>Item two</li>');
    expect(html).toContain('</ul>');
  });

  it('converts ordered list items to <ol><li>', () => {
    const md = '1. First\n2. Second';
    const html = buildMarkdownAsHtml(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('<li>Second</li>');
    expect(html).toContain('</ol>');
  });

  it('converts **bold** to <strong>', () => {
    expect(buildMarkdownAsHtml('**Confidence:** high')).toContain('<strong>Confidence:</strong>');
  });

  it('converts _italic_ to <em>', () => {
    expect(buildMarkdownAsHtml('_Generated: 2026-06-22_')).toContain('<em>Generated: 2026-06-22</em>');
  });

  it('wraps plain text paragraphs in <p>', () => {
    const html = buildMarkdownAsHtml('This is a plain paragraph.');
    expect(html).toContain('<p>This is a plain paragraph.</p>');
  });

  it('escapes HTML special characters in content', () => {
    const html = buildMarkdownAsHtml('Score < 5 & peak > -3 dB');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&amp;');
  });
});

describe('buildInvestigationPrintDocument', () => {
  it('returns a complete HTML document string', () => {
    const html = buildInvestigationPrintDocument({
      title: 'Test Report',
      markdownContent: '## Section\n\nSome content.',
      timestamp: '2026-06-22T10:00:00.000Z',
    });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Test Report</title>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).not.toContain('<pre>');
  });

  it('escapes HTML in the title so it is not rendered as markup', () => {
    const html = buildInvestigationPrintDocument({
      title: '<b>Injected</b>',
      markdownContent: 'Content.',
      timestamp: '2026-06-22T10:00:00.000Z',
    });
    // The injected tag should be escaped, not rendered as a bold element
    expect(html).toContain('&lt;b&gt;Injected&lt;/b&gt;');
    expect(html).not.toContain('<title><b>Injected</b></title>');
  });

  it('includes a window.print() call in the script', () => {
    const html = buildInvestigationPrintDocument({
      title: 'Report',
      markdownContent: 'Body.',
      timestamp: '2026-06-22T10:00:00.000Z',
    });
    expect(html).toContain('window.print()');
  });
});
