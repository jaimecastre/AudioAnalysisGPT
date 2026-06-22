import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { Modal, Button, Group, Text, TextInput } from '@mantine/core';
import { IconDownload, IconPrinter } from '@tabler/icons-react';
import type { ChatMessage } from '../store/chatSlice';
import { MarkdownBlock } from './MarkdownBlock';
import { buildInvestigationReportMarkdown } from '../utils/investigationReportSerializer';
import { buildReportMarkdownDownload } from '../utils/reportDownload';
import { buildInvestigationPrintDocument } from '../utils/reportPrint';

type ExportInvestigationModalProps = {
  opened: boolean;
  message: ChatMessage;
  userQuestion?: string;
  onClose: () => void;
};

function deriveDefaultTitle(userQuestion?: string): string {
  if (!userQuestion) return 'Acoustic Investigation Report';
  const trimmed = userQuestion.trim();
  return trimmed.length <= 60 ? trimmed : trimmed.slice(0, 57) + '…';
}

export function ExportInvestigationModal({
  opened,
  message,
  userQuestion,
  onClose,
}: ExportInvestigationModalProps): JSX.Element {
  const [title, setTitle] = useState(() => deriveDefaultTitle(userQuestion));
  const markdownContent = useMemo(
    () => buildInvestigationReportMarkdown(message, { title, userQuestion }),
    [title, message, userQuestion],
  );

  const handleDownload = (): void => {
    const download = buildReportMarkdownDownload({
      title,
      markdownContent,
      timestamp: message.timestamp,
    });
    const blob = new Blob([download.content], { type: download.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = download.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = (): void => {
    const html = buildInvestigationPrintDocument({ title, markdownContent, timestamp: message.timestamp });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Export Investigation Report"
      size="xl"
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}
    >
      <TextInput
        label="Report title"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
        size="xs"
        styles={{ input: { fontFamily: 'var(--font-mono)' } }}
      />

      {userQuestion && (
        <Text size="xs" c="dimmed">
          Question: <em>{userQuestion}</em>
        </Text>
      )}

      <div
        style={{
          maxHeight: 400,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '10px 14px',
          fontSize: '0.72rem',
        }}
      >
        <MarkdownBlock content={markdownContent} />
      </div>

      <Group gap="xs">
        <Button size="xs" variant="default" leftSection={<IconDownload size={13} />} onClick={handleDownload}>
          Download .md
        </Button>
        <Button size="xs" variant="default" leftSection={<IconPrinter size={13} />} onClick={handlePrint}>
          Print / Save PDF
        </Button>
      </Group>
    </Modal>
  );
}
