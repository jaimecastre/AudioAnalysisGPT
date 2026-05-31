import type { JSX } from 'react';
import { useState } from 'react';
import { Drawer, Loader, Tabs, Text, Group } from '@mantine/core';
import { AnalysisInspector } from '../analysis/AnalysisInspector';
import { SpectrumCard } from '../analysis/SpectrumCard';
import type { AnalysisResult } from '../analysis/analysisTypes';
import type { AnalysisStatus } from '../analysis/analysisSlice';
import type { SpectrumAnalysis, SpectrumUserParameters } from '../analysis/spectrumTypes';
import type { SpectrumStatus } from '../analysis/spectrumSlice';
import type { WaveformSelection } from '../waveform/waveformSelectionSlice';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  selectedFileName: string | null;
  spectrumResult: SpectrumAnalysis | null;
  spectrumStatus: SpectrumStatus;
  spectrumError: string | null;
  spectrumUserParameters: SpectrumUserParameters;
  activeSelection: WaveformSelection | null;
  onSetSpectrumFftSize: (fftSize: number) => void;
}

export const RightSidebar = ({
  isOpen,
  onClose,
  analysisResult,
  analysisStatus,
  analysisError,
  selectedFileName,
  spectrumResult,
  spectrumStatus,
  spectrumError,
  spectrumUserParameters,
  activeSelection,
  onSetSpectrumFftSize,
}: RightSidebarProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<string>('info');

  const panelIsLoading =
    (activeTab === 'info' && analysisStatus === 'running') ||
    (activeTab === 'spectrum' && spectrumStatus === 'running');

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
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="info">Info</Tabs.Tab>
          <Tabs.Tab value="spectrum">Spectrum</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="info" pt="xs">
          <AnalysisInspector
            result={analysisResult}
            status={analysisStatus}
            error={analysisError}
          />
        </Tabs.Panel>

        <Tabs.Panel value="spectrum" pt="xs">
          <SpectrumCard
            result={spectrumResult}
            status={spectrumStatus}
            error={spectrumError}
            activeSelection={activeSelection}
            userParameters={spectrumUserParameters}
            showCanvas={false}
            onSetFftSize={onSetSpectrumFftSize}
          />
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
};
