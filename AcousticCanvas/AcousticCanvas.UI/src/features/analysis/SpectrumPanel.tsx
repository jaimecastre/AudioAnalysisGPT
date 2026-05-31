import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Box, Checkbox } from '@mantine/core';
import { IconX, IconChartLine } from '@tabler/icons-react';
import { useAppSelector } from '../../store/reduxHooks';
import { useRunSpectrum } from './useRunSpectrum';
import {
  spectrumResultSelector,
  spectrumStatusSelector,
  spectrumErrorSelector,
  spectrumUserParametersSelector,
} from './spectrumSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { SpectrumCanvas } from './SpectrumCanvas';
import styles from './SpectrogramPanel.module.scss';

interface SpectrumPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
}

export const SpectrumPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
}: SpectrumPanelProps): JSX.Element => {
  const spectrumResult = useAppSelector(spectrumResultSelector);
  const spectrumStatus = useAppSelector(spectrumStatusSelector);
  const spectrumError = useAppSelector(spectrumErrorSelector);
  const spectrumUserParameters = useAppSelector(spectrumUserParametersSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const { runSpectrum } = useRunSpectrum();

  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<string>>(new Set());

  const toggleChannel = (channelId: string): void => {
    setHiddenChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  // Auto-run when file or selection changes.
  useEffect(() => {
    if (!selectedFileId) {
      return;
    }
    const hasRegion = activeSelection && activeSelection.endSeconds > activeSelection.startSeconds;
    if (!hasRegion) {
      return;
    }
    runSpectrum({
      fileId: selectedFileId,
      startSeconds: activeSelection.startSeconds,
      endSeconds: activeSelection.endSeconds,
      parameters: spectrumUserParameters,
    });
  }, [selectedFileId, activeSelection?.startSeconds, activeSelection?.endSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrumStatus === 'running';

  const visibleChannels = spectrumResult
    ? spectrumResult.channels
        .filter((ch) => !hiddenChannelIds.has(ch.channelId))
        .map((ch) => ({
          channelId: ch.channelId,
          channelName: ch.channelName,
          frequenciesHz: ch.frequenciesHz,
          magnitudes: ch.magnitudes,
          magnitudesDb: ch.magnitudesDb,
          yMode: ch.dbUnit ? ('db' as const) : ('linear' as const),
          yUnit: ch.dbUnit ?? ch.unit ?? '',
        }))
    : [];

  const hasMultipleChannels = spectrumResult && spectrumResult.channels.length > 1;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <IconChartLine size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Spectrum
          </Text>
          <Select
            size="xs"
            placeholder="Select file…"
            data={fileSelectOptions}
            value={selectedFileId}
            onChange={(value) => onFileSelect(panelId, value)}
            style={{ flex: 1, minWidth: 0, maxWidth: 220 }}
            styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
          />
          {isRunning && <Loader size="xs" color="teal" />}
          {hasMultipleChannels && spectrumResult && (
            <Group gap="sm">
              {spectrumResult.channels.map((ch) => (
                <Checkbox
                  key={ch.channelId}
                  size="xs"
                  label={ch.channelName}
                  checked={!hiddenChannelIds.has(ch.channelId)}
                  onChange={() => toggleChannel(ch.channelId)}
                />
              ))}
            </Group>
          )}
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => onClose(panelId)}
          aria-label="Close spectrum panel"
        >
          <IconX size={13} />
        </ActionIcon>
      </div>

      <div className={styles.panelBody}>
        {!selectedFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run spectrum</Text>
          </div>
        )}
        {selectedFileId && !activeSelection && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a region on the waveform</Text>
          </div>
        )}
        {selectedFileId && spectrumStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{spectrumError ?? 'Analysis failed'}</Text>
          </div>
        )}
        {visibleChannels.length > 0 && (
          <Box style={{ height: 200, padding: '8px' }}>
            <SpectrumCanvas channels={visibleChannels} />
          </Box>
        )}
      </div>
    </div>
  );
};
