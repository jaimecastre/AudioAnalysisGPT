export type ReportPrintDocumentInput = {
  title: string;
  markdownContent: string;
  timestamp: string;
};

export function buildReportPrintDocument(input: ReportPrintDocumentInput): string {
  const title = input.title.trim().length > 0 ? input.title.trim() : 'Acoustic QA Report';
  const generatedAt = formatGeneratedAt(input.timestamp);
  const escapedTitle = escapeHtml(title);
  const escapedGeneratedAt = escapeHtml(generatedAt);
  const escapedMarkdown = escapeHtml(input.markdownContent);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: #ffffff;
      color: #111827;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 32px;
      background: #ffffff;
      color: #111827;
    }

    main {
      max-width: 860px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 700;
    }

    .generated-at {
      margin: 0 0 24px;
      font-size: 12px;
      color: #4b5563;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      line-height: 1.55;
      color: #111827;
    }

    @page {
      margin: 18mm;
    }

    @media print {
      body {
        padding: 0;
      }

      main {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapedTitle}</h1>
    <p class="generated-at">Generated: ${escapedGeneratedAt}</p>
    <pre>${escapedMarkdown}</pre>
  </main>
  <script>
    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 100);
  </script>
</body>
</html>`;
}

export function buildInvestigationPrintDocument(input: ReportPrintDocumentInput): string {
  const title = input.title.trim().length > 0 ? input.title.trim() : 'Acoustic Investigation Report';
  const generatedAt = formatGeneratedAt(input.timestamp);
  const escapedTitle = escapeHtml(title);
  const escapedGeneratedAt = escapeHtml(generatedAt);
  const bodyHtml = buildMarkdownAsHtml(input.markdownContent);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #ffffff;
      color: #111827;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 32px;
      background: #ffffff;
      color: #111827;
    }

    main { max-width: 860px; margin: 0 auto; }

    h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
    h2 { margin: 24px 0 8px; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    h3 { margin: 16px 0 6px; font-size: 14px; font-weight: 600; }

    .generated-at { margin: 0 0 24px; font-size: 12px; color: #4b5563; }

    p { margin: 0 0 10px; font-size: 13px; line-height: 1.6; }

    table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 10px; border: 1px solid #d1d5db; font-weight: 600; }
    td { padding: 5px 10px; border: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }

    ul, ol { margin: 6px 0 10px 20px; padding: 0; font-size: 13px; line-height: 1.7; }
    li { margin-bottom: 2px; }

    em { font-style: italic; color: #4b5563; }
    strong { font-weight: 700; }

    @page { margin: 18mm; }

    @media print {
      body { padding: 0; }
      main { max-width: none; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapedTitle}</h1>
    <p class="generated-at">Generated: ${escapedGeneratedAt}</p>
    ${bodyHtml}
  </main>
  <script>
    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 100);
  </script>
</body>
</html>`;
}

/**
 * Converts a controlled subset of Markdown to HTML.
 * Handles: headings, bold, italic, tables, unordered lists, ordered lists, paragraphs.
 * All text content is HTML-escaped.
 */
export function buildMarkdownAsHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Heading
    const headingMatch = /^(#{1,3}) (.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const text = inlineMarkdown(headingMatch[2]!);
      output.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // Table: collect consecutive | lines
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith('|')) {
        tableLines.push(lines[i]!);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    // Unordered list: collect consecutive "- " lines
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i]!)) {
        items.push(`<li>${inlineMarkdown(lines[i]!.slice(2))}</li>`);
        i++;
      }
      output.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }

    // Ordered list: collect consecutive "N. " lines
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]!)) {
        const text = lines[i]!.replace(/^\d+\. /, '');
        items.push(`<li>${inlineMarkdown(text)}</li>`);
        i++;
      }
      output.push(`<ol>\n${items.join('\n')}\n</ol>`);
      continue;
    }

    // Blank line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Plain paragraph
    output.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }

  return output.join('\n');
}

function renderTable(lines: string[]): string {
  const rows: string[][] = lines
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

  const output: string[] = ['<table>'];
  let headerDone = false;

  for (const row of rows) {
    // Separator row (e.g. |---|---|) — skip
    if (row.every((cell) => /^-+$/.test(cell))) {
      headerDone = true;
      continue;
    }

    if (!headerDone) {
      const cells = row.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('');
      output.push(`<tr>${cells}</tr>`);
    } else {
      const cells = row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('');
      output.push(`<tr>${cells}</tr>`);
    }
  }

  output.push('</table>');
  return output.join('\n');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    // **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // _italic_
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function formatGeneratedAt(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'unavailable';
  }

  return parsed.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
