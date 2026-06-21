import { buildReportMarkdownDownload } from '../utils/reportDownload';

type UseReportDownloadInput = {
  title: string;
  markdownContent: string;
  timestamp: string;
};

export function useReportDownload(input: UseReportDownloadInput) {
  const handleDownload = (): void => {
    const download = buildReportMarkdownDownload(input);
    const blob = new Blob([download.content], { type: download.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = download.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return { handleDownload };
}
