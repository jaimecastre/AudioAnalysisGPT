import type { JSX } from 'react';
import { Drawer, Loader, Text, Group } from '@mantine/core';
import { AnalysisInspector } from '../analysis/AnalysisInspector';
import type { AnalysisResult } from '../analysis/analysisTypes';
import type { AnalysisStatus } from '../analysis/analysisSlice';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  selectedFileName: string | null;
}

export const RightSidebar = ({
  isOpen,
  onClose,
  analysisResult,
  analysisStatus,
  analysisError,
  selectedFileName,
}: RightSidebarProps): JSX.Element => {
  const panelIsLoading = analysisStatus === 'running';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size={320}
      title={
        <Group gap="xs">
          <Text size="sm" fw={600}>Inspector</Text>
          {selectedFileName && (
            <Text size="xs" c="dimmed" truncate style={{ maxWidth: 180 }}>
              {selectedFileName}
            </Text>
          )}
          {panelIsLoading && <Loader size={12} color="teal" />}
        </Group>
      }
      closeButtonProps={{ 'aria-label': 'Close inspector' }}
    >
      <AnalysisInspector
        result={analysisResult}
        status={analysisStatus}
        error={analysisError}
      />
    </Drawer>
  );
};
