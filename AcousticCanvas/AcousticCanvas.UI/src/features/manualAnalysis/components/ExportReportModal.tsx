import type { JSX } from 'react';
import { useState } from 'react';
import { Modal, Button, Group, Text, TextInput, Loader, Alert } from '@mantine/core';
import { IconDownload, IconPrinter, IconAlertTriangle } from '@tabler/icons-react';
import type { AudioFile } from '../../../store/projectState';
import { MarkdownBlock } from '../../agentAnalysis/components/MarkdownBlock';
import { useGenerateReport } from '../../analysis/hooks/useGenerateReport';
import { buildReportMarkdownDownload } from '../../agentAnalysis/utils/reportDownload';
import { buildReportPrintDocument } from '../../agentAnalysis/utils/reportPrint';

type ActiveSelection = {
  startSeconds: number;
  endSeconds: number;
};

type ExportReportModalProps = {
  opened: boolean;
  files: AudioFile[];
  activeSelection: ActiveSelection | null;
  onClose: () => void;
};

export const ExportReportModal = ({ opened, files, activeSelection, onClose }: ExportReportModalProps): JSX.Element => {
  const [title, setTitle] = useState('Acoustic QA Report');
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [generatedAtUtc, setGeneratedAtUtc] = useState<string | null>(null);
  const { generateReport, isGenerating, error } = useGenerateReport();

  const regionLabel = activeSelection
    ? `${activeSelection.startSeconds.toFixed(2)}s – ${activeSelection.endSeconds.toFixed(2)}s`
    : null;

  const handleGenerate = async (): Promise<void> => {
    const fileIds = files.map((file) => file.id);
    const result = await generateReport({
      fileIds,
      title,
      startSeconds: activeSelection?.startSeconds,
      endSeconds: activeSelection?.endSeconds,
    });
    if (result) {
      setMarkdownContent(result.markdownContent);
      setGeneratedAtUtc(result.generatedAtUtc);
    }
  };

  const handleDownload = (): void => {
    if (!markdownContent || !generatedAtUtc) return;
    const download = buildReportMarkdownDownload({
      title,
      markdownContent,
      timestamp: generatedAtUtc,
      regionStartSeconds: activeSelection?.startSeconds,
      regionEndSeconds: activeSelection?.endSeconds,
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
    if (!markdownContent || !generatedAtUtc) return;
    const html = buildReportPrintDocument({ title, markdownContent, timestamp: generatedAtUtc });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleClose = (): void => {
    setMarkdownContent(null);
    setGeneratedAtUtc(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Export Session Report"
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

      <Text size="xs" c="dimmed">
        {files.length} file{files.length !== 1 ? 's' : ''} · {' '}
        {regionLabel ? <><strong>region {regionLabel}</strong></> : 'full file'}
        {' — '}{files.map((file) => file.name).join(', ')}
      </Text>

      {error && (
        <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {!markdownContent && (
        <Button
          size="xs"
          color="teal"
          onClick={handleGenerate}
          loading={isGenerating}
          disabled={files.length === 0}
          leftSection={isGenerating ? <Loader size={12} color="white" /> : undefined}
        >
          {isGenerating ? 'Generating report…' : 'Generate Report'}
        </Button>
      )}

      {markdownContent && (
        <>
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', fontSize: '0.72rem' }}>
            <MarkdownBlock content={markdownContent} />
          </div>
          <Group gap="xs">
            <Button size="xs" variant="default" leftSection={<IconDownload size={13} />} onClick={handleDownload}>
              Download .md
            </Button>
            <Button size="xs" variant="default" leftSection={<IconPrinter size={13} />} onClick={handlePrint}>
              Print / Save PDF
            </Button>
            <Button size="xs" color="teal" variant="light" onClick={handleGenerate} loading={isGenerating}>
              Regenerate
            </Button>
          </Group>
        </>
      )}
    </Modal>
  );
};
