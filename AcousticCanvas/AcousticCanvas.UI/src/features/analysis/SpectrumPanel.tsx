import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Select, ActionIcon, Text, Group, Loader, Box, Checkbox, Badge } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconX, IconChartLine } from '@tabler/icons-react';
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(200);
  const effectiveFileId = selectedFileId ?? availableFiles[0]?.id ?? null;
  const selectedFile = availableFiles.find((file) => file.id === effectiveFileId);
  const hasRegion = Boolean(activeSelection && activeSelection.endSeconds > activeSelection.startSeconds);
  const regionStartSeconds = activeSelection?.startSeconds;
  const regionEndSeconds = activeSelection?.endSeconds;

  useEffect(() => {
    if (!selectedFileId && effectiveFileId) {
      onFileSelect(panelId, effectiveFileId);
    }
  }, [effectiveFileId, onFileSelect, panelId, selectedFileId]);

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
    if (!effectiveFileId || !hasRegion) return;
    const timeoutId = window.setTimeout(() => {
      runSpectrum({
        fileId: effectiveFileId,
        startSeconds: regionStartSeconds!,
        endSeconds: regionEndSeconds!,
        parameters: spectrumUserParameters,
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveFileId, hasRegion, regionStartSeconds, regionEndSeconds, spectrumUserParameters, runSpectrum]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrumStatus === 'running';

  const visibleChannels = spectrumResult && hasRegion
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

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const startY = event.clientY;
    const startHeight = panelHeight;
    const handlePointerMove = (pointerEvent: PointerEvent): void => {
      setPanelHeight(Math.max(140, Math.min(420, startHeight + pointerEvent.clientY - startY)));
    };
    const handlePointerUp = (): void => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <IconChartLine size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Spectrum
          </Text>
          {availableFiles.length > 1 ? (
            <Select
              size="xs"
              placeholder="Select file…"
              data={fileSelectOptions}
              value={effectiveFileId}
              onChange={(value) => onFileSelect(panelId, value)}
              style={{ flex: 1, minWidth: 0, maxWidth: 220 }}
              styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem' } }}
            />
          ) : (
            <Text size="xs" ff="var(--font-mono)" truncate style={{ maxWidth: 220 }}>
              {selectedFile?.name ?? 'No file'}
            </Text>
          )}
          <Badge size="xs" variant="light" color={hasRegion ? 'teal' : 'gray'}>
            {hasRegion
              ? `${activeSelection!.startSeconds.toFixed(3)}s - ${activeSelection!.endSeconds.toFixed(3)}s`
              : 'Select region'}
          </Badge>
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
        <Group gap={2}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand spectrum panel' : 'Collapse spectrum panel'}>
            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onClose(panelId)}
            aria-label="Close spectrum panel"
          >
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </div>

      {!isCollapsed && <div className={styles.panelBody}>
        {!effectiveFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run spectrum</Text>
          </div>
        )}
        {effectiveFileId && !hasRegion && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a region on the waveform</Text>
          </div>
        )}
        {effectiveFileId && spectrumStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{spectrumError ?? 'Analysis failed'}</Text>
          </div>
        )}
        {visibleChannels.length > 0 && (
          <Box style={{ height: panelHeight, padding: '8px' }}>
            <SpectrumCanvas channels={visibleChannels} />
          </Box>
        )}
        {visibleChannels.length > 0 && (
          <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
        )}
      </div>}
    </div>
  );
};
