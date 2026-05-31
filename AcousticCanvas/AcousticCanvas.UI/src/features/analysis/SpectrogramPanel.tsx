import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Select, ActionIcon, Text, Group, Loader } from '@mantine/core';
import { IconX, IconWaveSine } from '@tabler/icons-react';
import { useAppSelector } from '../../store/reduxHooks';
import { useRunSpectrogram } from './useRunSpectrogram';
import {
  spectrogramResultSelector,
  spectrogramStatusSelector,
  spectrogramErrorSelector,
} from './spectrogramSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import type { ChannelSpectrogramAnalysis } from './spectrogramTypes';
import styles from './SpectrogramPanel.module.scss';

const CANVAS_HEIGHT = 200;
const AXIS_WIDTH = 52;
const FONT = "10px 'JetBrains Mono', ui-monospace, monospace";
const LABEL_COLOR = 'rgba(0,0,0,0.45)';

// Pre-built 256-entry RGBA lookup table: dark blue → teal → yellow → white.
function buildColorTable(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  const stops = [
    { pos: 0,    r: 13,  g: 3,   b: 33  },
    { pos: 0.25, r: 10,  g: 59,  b: 107 },
    { pos: 0.5,  r: 26,  g: 128, b: 143 },
    { pos: 0.75, r: 245, g: 186, b: 66  },
    { pos: 1.0,  r: 255, g: 255, b: 255 },
  ];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let si = 0;
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].pos) si = s;
    }
    const a = stops[si];
    const b = stops[Math.min(si + 1, stops.length - 1)];
    const span = b.pos - a.pos;
    const f = span > 0 ? (t - a.pos) / span : 0;
    table[i * 4 + 0] = Math.round(a.r + (b.r - a.r) * f);
    table[i * 4 + 1] = Math.round(a.g + (b.g - a.g) * f);
    table[i * 4 + 2] = Math.round(a.b + (b.b - a.b) * f);
    table[i * 4 + 3] = 255;
  }
  return table;
}

const COLOR_TABLE = buildColorTable();

// Draws the spectrogram frames onto a canvas.
// frequencyData shape: [frameIndex][binIndex], values 0-255.
// Bins run low→high; we flip vertically so 0 Hz is at the bottom.
function drawSpectrogramToCanvas(
  canvas: HTMLCanvasElement,
  frequencyData: number[][],
): void {
  const numFrames = frequencyData.length;
  const numBins = frequencyData[0]?.length ?? 0;
  if (numFrames === 0 || numBins === 0) return;

  canvas.width = numFrames;
  canvas.height = numBins;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(numFrames, numBins);
  const pixels = imageData.data;

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frame = frequencyData[frameIdx];
    for (let binIdx = 0; binIdx < numBins; binIdx++) {
      const value = frame[binIdx];
      // Flip vertically: bin 0 (DC/low freq) → bottom row of canvas.
      const flippedBin = numBins - 1 - binIdx;
      const pixelOffset = (flippedBin * numFrames + frameIdx) * 4;
      pixels[pixelOffset + 0] = COLOR_TABLE[value * 4 + 0];
      pixels[pixelOffset + 1] = COLOR_TABLE[value * 4 + 1];
      pixels[pixelOffset + 2] = COLOR_TABLE[value * 4 + 2];
      pixels[pixelOffset + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Draws frequency axis labels on a separate canvas.
function drawFrequencyAxis(
  axisCanvas: HTMLCanvasElement,
  nyquistHz: number,
  height: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  axisCanvas.width = AXIS_WIDTH * dpr;
  axisCanvas.height = height * dpr;
  axisCanvas.style.width = `${AXIS_WIDTH}px`;
  axisCanvas.style.height = `${height}px`;

  const ctx = axisCanvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, AXIS_WIDTH, height);
  ctx.font = FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const fraction = i / numTicks;
    const freqHz = fraction * nyquistHz;
    const y = height - fraction * height;

    const labelText = freqHz >= 1000
      ? `${(freqHz / 1000).toFixed(1)} kHz`
      : `${Math.round(freqHz)} Hz`;

    ctx.fillText(labelText, AXIS_WIDTH - 4, Math.max(6, Math.min(y, height - 6)));
  }
}

interface SpectrogramPanelProps {
  panelId: string;
  availableFiles: Array<{ id: string; name: string }>;
  selectedFileId: string | null;
  onFileSelect: (panelId: string, fileId: string | null) => void;
  onClose: (panelId: string) => void;
}

export const SpectrogramPanel = ({
  panelId,
  availableFiles,
  selectedFileId,
  onFileSelect,
  onClose,
}: SpectrogramPanelProps): JSX.Element => {
  const spectrogramResult = useAppSelector(spectrogramResultSelector);
  const spectrogramStatus = useAppSelector(spectrogramStatusSelector);
  const spectrogramError = useAppSelector(spectrogramErrorSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const { runSpectrogram } = useRunSpectrogram();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-run when file or selection changes.
  useEffect(() => {
    if (!selectedFileId) return;
    const hasRegion = activeSelection && activeSelection.endSeconds > activeSelection.startSeconds;
    const startSeconds = hasRegion ? activeSelection.startSeconds : 0;
    const endSeconds = hasRegion ? activeSelection.endSeconds : Number.MAX_SAFE_INTEGER;
    runSpectrogram({
      fileId: selectedFileId,
      startSeconds,
      endSeconds,
      parameters: { fftSize: 2048, overlap: 0.75 },
    });
  }, [selectedFileId, activeSelection?.startSeconds, activeSelection?.endSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paint canvas when data arrives.
  useEffect(() => {
    const canvas = canvasRef.current;
    const axisCanvas = axisCanvasRef.current;
    if (!canvas || !axisCanvas) return;
    if (!spectrogramResult || spectrogramResult.channels.length === 0) return;

    const channelData: ChannelSpectrogramAnalysis = spectrogramResult.channels[0];
    if (channelData.frequencyData.length === 0) return;

    drawSpectrogramToCanvas(canvas, channelData.frequencyData);

    const nyquistHz = spectrogramResult.parameters.sampleRate / 2;
    drawFrequencyAxis(axisCanvas, nyquistHz, CANVAS_HEIGHT);
  }, [spectrogramResult]);

  const fileSelectOptions = availableFiles.map((f) => ({ value: f.id, label: f.name }));
  const isRunning = spectrogramStatus === 'running';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <IconWaveSine size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Text size="xs" fw={600} tt="uppercase" ff="var(--font-mono)" c="dimmed" style={{ letterSpacing: '0.06em' }}>
            Spectrogram
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
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onClose(panelId)} aria-label="Close spectrogram panel">
          <IconX size={13} />
        </ActionIcon>
      </div>

      <div className={styles.panelBody}>
        {!selectedFileId && (
          <div className={styles.emptyState}>
            <Text size="sm" c="dimmed">Select a file above to run spectrogram</Text>
          </div>
        )}
        {selectedFileId && spectrogramStatus === 'error' && (
          <div className={styles.emptyState}>
            <Text size="sm" c="red">{spectrogramError ?? 'Analysis failed'}</Text>
          </div>
        )}
        {selectedFileId && spectrogramStatus !== 'error' && (
          <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: CANVAS_HEIGHT }}>
            <canvas
              ref={axisCanvasRef}
              style={{ flexShrink: 0, display: 'block' }}
            />
            <canvas
              ref={canvasRef}
              style={{ flex: 1, minWidth: 0, display: 'block', height: CANVAS_HEIGHT, imageRendering: 'pixelated' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
