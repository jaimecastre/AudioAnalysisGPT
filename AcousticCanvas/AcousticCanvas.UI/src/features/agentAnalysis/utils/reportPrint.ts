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
