import { useState } from 'react';

export function useReportCopy(markdownContent: string) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    navigator.clipboard.writeText(markdownContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // silently ignore clipboard errors
    });
  };

  return { copied, handleCopy };
}
