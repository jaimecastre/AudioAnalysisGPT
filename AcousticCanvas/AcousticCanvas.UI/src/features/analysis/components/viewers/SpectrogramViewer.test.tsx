import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { SpectrogramViewer } from './SpectrogramViewer';
import type { SpectrogramAnalysis } from '../../types/spectrogramTypes';

describe('SpectrogramViewer', () => {
  it('renders the same axis-bearing plot structure as the manual spectrogram view', () => {
    const result: SpectrogramAnalysis = {
      parameters: {
        fftSize: 2048,
        windowType: 'Hann',
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
      region: {
        startSeconds: 0,
        endSeconds: 1,
        durationSeconds: 1,
      },
      channels: [
        {
          channelId: '1',
          channelName: 'Channel 1',
          binCount: 2,
          frameCount: 2,
          nyquistHz: 24000,
          frequencyData: ['AAE=', 'AgM='],
          calibrationState: 'digital_full_scale',
          colorbandLabel: 'Amplitude [dBFS]',
        },
      ],
      frequencyAxisTicks: [
        { positionPercent: 100, label: '0 Hz' },
        { positionPercent: 0, label: '24 kHz' },
      ],
      timeAxisTicks: [
        { positionPercent: 0, label: '0.00s' },
        { positionPercent: 100, label: '1.00s' },
      ],
    };

    const markup = renderToStaticMarkup(
      <MantineProvider>
        <SpectrogramViewer result={result} />
      </MantineProvider>,
    );

    expect(markup).toContain('aria-label="Spectrogram frequency axis"');
    expect(markup).toContain('aria-label="Spectrogram time axis"');
    expect(markup).toContain('aria-label="Spectrogram color scale"');
    expect(markup).toContain('Amplitude [dBFS]');
  });
});
