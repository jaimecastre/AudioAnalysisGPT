import {
  buildReportPrintDocument,
  type ReportPrintDocumentInput,
} from '../utils/reportPrint';

export function useReportPrint(input: ReportPrintDocumentInput) {
  const handlePrint = (): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReportPrintDocument(input));
    printWindow.document.close();
  };

  return { handlePrint };
}
