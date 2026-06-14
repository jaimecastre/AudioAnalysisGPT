import type { JSX } from 'react';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import type { AnalysisViewBlock as AnalysisViewBlockType } from '../services/agentAskService';
import type { AnalysisResult } from '../../analysis/store/analysisResultsSlice';

vi.mock('../../analysis/components/SpectrumCanvas', () => ({
  SpectrumCanvas: (): JSX.Element => <div data-testid="spectrum-preview">Spectrum preview</div>,
}));

vi.mock('../../analysis/components/SpectrogramPlot', () => ({
  SpectrogramPlot: (): JSX.Element => <div data-testid="manual-spectrogram-plot">Manual spectrogram plot</div>,
}));

vi.mock('../../analysis/components/CpbCanvas', () => ({
  CpbCanvas: (): JSX.Element => <div data-testid="manual-cpb-canvas">Manual CPB canvas</div>,
}));

vi.mock('../../analysis/hooks/useAnalysisResult', () => ({
  useAnalysisResult: vi.fn(),
}));

const { useAnalysisResult } = await import('../../analysis/hooks/useAnalysisResult');
const { AnalysisViewBlock } = await import('./AnalysisViewBlock');

const useAnalysisResultMock = useAnalysisResult as Mock;

describe('AnalysisViewBlock', () => {
  beforeEach(() => {
    useAnalysisResultMock.mockReturnValue({ result: null, isLoading: false, error: null });
  });

  it('renders spectrum preview only for spectrum blocks', () => {
    const spectrumBlock: AnalysisViewBlockType = {
      blockType: 'analysisView',
      viewType: 'spectrum',
      resultId: 'spectrum_0123456789abcdef0123456789abcdef',
      fileId: 'file-a',
      fileName: 'tone.wav',
      title: 'Spectrum Analysis',
      summary: {
        statusText: 'Complete',
        statusIndicator: 'success',
      },
      preview: {
        frequenciesHz: [0, 100, 200],
        magnitudesDb: [-80, -60, -40],
      },
    };

    const markup = renderToStaticMarkup(
      <MantineProvider>
        <AnalysisViewBlock block={spectrumBlock} />
      </MantineProvider>,
    );

    expect(markup).toContain('Spectrum preview');
    expect(markup).toContain('height:180px');
  });

  it.each(['spectrogram', 'cpb', 'soundQuality', 'findings'] as const)(
    'renders a manual-view-coherent compact preview for %s blocks instead of the spectrum preview',
    (viewType) => {
    useAnalysisResultMock.mockReturnValue({
      result: buildAnalysisResult(viewType),
      isLoading: false,
      error: null,
    });

    const block: AnalysisViewBlockType = {
      blockType: 'analysisView',
      viewType,
      resultId: `${viewType.toLowerCase()}_0123456789abcdef0123456789abcdef`,
      fileId: 'file-a',
      fileName: 'tone.wav',
      title: `${viewType} Analysis`,
      summary: {
        statusText: 'Complete',
        statusIndicator: 'success',
      },
      preview: {
        frequenciesHz: [0, 100, 200],
        magnitudesDb: [-80, -60, -40],
      },
    };

    const markup = renderToStaticMarkup(
      <MantineProvider>
        <AnalysisViewBlock block={block} />
      </MantineProvider>,
    );

    expect(markup).not.toContain('Spectrum preview');
    expect(markup).toContain(`data-preview-type="${viewType}"`);
    expect(markup).toContain(getManualPreviewMarker(viewType));
    },
  );
});

function getManualPreviewMarker(viewType: 'spectrogram' | 'cpb' | 'soundQuality' | 'findings'): string {
  if (viewType === 'spectrogram') {
    return 'Manual spectrogram plot';
  }

  if (viewType === 'cpb') {
    return 'Manual CPB canvas';
  }

  if (viewType === 'soundQuality') {
    return 'Loudness';
  }

  return 'Transient';
}

function buildAnalysisResult(viewType: 'spectrogram' | 'cpb' | 'soundQuality' | 'findings'): AnalysisResult {
  if (viewType === 'spectrogram') {
    return {
      type: 'spectrogram',
      data: {
        parameters: {
          fftSize: 1024,
          windowType: 'hann',
          overlap: 0.75,
          scale: 'mel',
          gainDb: 20,
          rangeDb: 80,
          startTimeSeconds: 0,
          endTimeSeconds: 1,
          frameCount: 2,
          binCount: 2,
          sampleRate: 48000,
          minDbSpl: -68,
          maxDbSpl: 55,
        },
        region: { startSeconds: 0, endSeconds: 1, durationSeconds: 1 },
        channels: [{
          channelId: '1',
          channelName: 'Channel 1',
          binCount: 2,
          frameCount: 2,
          nyquistHz: 24000,
          frequencyData: ['AAE=', 'AQI='],
          calibrationState: 'digital_full_scale',
          colorbandLabel: 'Amplitude [dBFS]',
        }],
        timeAxisTicks: [{ positionPercent: 0, label: '0 s' }],
        frequencyAxisTicks: [{ positionPercent: 50, label: '1k' }],
      },
    };
  }

  if (viewType === 'cpb') {
    return {
      type: 'cpb',
      data: {
        parameters: {
          bandMode: 'third_octave',
          bandsPerOctave: 3,
          fftSize: 4096,
          windowType: 'hann',
          overlap: 0.5,
          averaging: 'energy',
          scaling: 'rms',
          method: 'fft_bin_power_sum',
          weighting: 'z',
          weightingMethod: 'none',
          limitations: [],
          startTimeSeconds: 0,
          endTimeSeconds: 1,
          blockCount: 1,
          sampleRate: 48000,
        },
        region: { startSeconds: 0, endSeconds: 1, durationSeconds: 1 },
        channels: [{
          channelId: '1',
          channelName: 'Channel 1',
          quantity: 'level',
          unit: 'dB',
          dbUnit: 'dB',
          bands: [{
            label: '1k',
            centerFrequencyHz: 1000,
            lowerFrequencyHz: 891,
            upperFrequencyHz: 1122,
            plotLowerFrequencyHz: 891,
            plotUpperFrequencyHz: 1122,
            magnitude: 1,
            levelDb: 42,
            binCount: 12,
          }],
        }],
      },
    };
  }

  if (viewType === 'soundQuality') {
    return {
      type: 'soundQuality',
      data: {
        parameters: {
          method: 'MoSQITo',
          library: 'mosqito',
          startTimeSeconds: 0,
          endTimeSeconds: 1,
          sampleRate: 48000,
          limitations: [],
        },
        region: { startSeconds: 0, endSeconds: 1, durationSeconds: 1 },
        loudness: { name: 'Loudness', value: 8.74, unit: 'sone', method: 'MoSQITo' },
        sharpness: { name: 'Sharpness', value: 0.8, unit: 'acum', method: 'MoSQITo' },
        roughness: { name: 'Roughness', value: 0.1, unit: 'asper', method: 'MoSQITo' },
      },
    };
  }

  return {
    type: 'findings',
    data: {
      fileId: 'file-a',
      findingCount: 1,
      ranAt: '2026-06-14T19:00:00.000Z',
      findings: [{
        findingId: 'finding-a',
        fileId: 'file-a',
        type: 'level',
        severity: 'medium',
        confidence: 'observed',
        title: 'Transient',
        description: 'Detected transient energy.',
        evidence: {},
        startSeconds: 0.25,
        endSeconds: 0.5,
        frequencyHz: 1000,
        suggestedNextStep: 'Inspect the event.',
        generatedAt: '2026-06-14T19:00:00.000Z',
      }],
    },
  };
}
