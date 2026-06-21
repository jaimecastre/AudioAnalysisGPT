export type ReportMarkdownDownload = {
  filename: string;
  mimeType: string;
  content: string;
};

export type ReportMarkdownDownloadInput = {
  title: string;
  markdownContent: string;
  timestamp: string;
  regionStartSeconds?: number;
  regionEndSeconds?: number;
};

export function buildReportMarkdownDownload(input: ReportMarkdownDownloadInput): ReportMarkdownDownload {
  const regionSuffix =
    input.regionStartSeconds !== undefined && input.regionEndSeconds !== undefined
      ? `_${input.regionStartSeconds.toFixed(3)}s-${input.regionEndSeconds.toFixed(3)}s`
      : '';
  return {
    filename: `${buildReportFilenameBase(input.title)}${regionSuffix}-${formatDateForFilename(input.timestamp)}.md`,
    mimeType: 'text/markdown;charset=utf-8',
    content: input.markdownContent,
  };
}

function buildReportFilenameBase(title: string): string {
  const normalizedTitle = title.trim().length > 0 ? title : 'Acoustic QA Report';
  const slug = normalizedTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'acoustic-qa-report';
}

function formatDateForFilename(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}
