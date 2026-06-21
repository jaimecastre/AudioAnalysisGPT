import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { ActiveSignalCard } from './ActiveSignalCard';
import type { AudioFile } from '../../../store/projectState';
import { store } from '../../../store/reduxStore';

const audioFile: AudioFile = {
  id: 'file-a',
  name: 'fan-a.wav',
  durationSeconds: 10,
  sampleRate: 48000,
  channels: 1,
  bitDepth: 24,
  fileSizeBytes: 480000,
};

describe('ActiveSignalCard', () => {
  it('shows a prominent comparison progress panel while compare is loading', () => {
    const markup = renderToStaticMarkup(
      <Provider store={store}>
        <MantineProvider>
          <ActiveSignalCard
            file={audioFile}
            audioUrl=""
            waveSurferRef={{ current: null }}
            currentTime={null}
            activeSelection={null}
            toolPanels={[]}
            allFiles={[audioFile]}
            manualCompareResult={null}
            manualCompareStatus="loading"
            manualCompareError={null}
            manualBenchmarkResult={null}
            manualBenchmarkStatus="idle"
            manualBenchmarkError={null}
            isBenchmarkPanelOpen={false}
            isFindingsPanelOpen={false}
            onWaveSurferReady={() => undefined}
            onWaveSurferTimeUpdate={() => undefined}
            onWaveSurferFinish={() => undefined}
            onWaveSurferUserSelectionChange={() => undefined}
            onCloseComparisonPanel={() => undefined}
            onRerunCompare={() => undefined}
            onRerunBenchmark={() => undefined}
            onCloseBenchmarkPanel={() => undefined}
            onCloseFindingsPanel={() => undefined}
            onClearWaveformSelection={() => undefined}
            onZoomToSelection={() => undefined}
            onResetWaveformZoom={() => undefined}
            showInvestigationPrompt={false}
            onPromptOpenFindings={() => undefined}
            onPromptAddSpectrum={() => undefined}
            onPromptAddCpb={() => undefined}
            onPromptAddSoundQuality={() => undefined}
            onToolPanelFileSelect={() => undefined}
            onToolPanelToggleSpan={() => undefined}
            onToolPanelClose={() => undefined}
            onSeek={() => undefined}
            analysisResult={null}
            spectrumResult={null}
            findings={[]}
            findingsStatus="idle"
          />
        </MantineProvider>
      </Provider>,
    );

    expect(markup).toContain('Comparing files');
    expect(markup).toContain('Building A/B spectrum, band energy, and sound-quality deltas.');
    expect(markup).toContain('role="status"');
  });

  it('shows a prominent benchmark progress panel while benchmark is loading with the benchmark panel open', () => {
    const markup = renderToStaticMarkup(
      <Provider store={store}>
        <MantineProvider>
          <ActiveSignalCard
            file={audioFile}
            audioUrl=""
            waveSurferRef={{ current: null }}
            currentTime={null}
            activeSelection={null}
            toolPanels={[]}
            allFiles={[audioFile]}
            manualCompareResult={null}
            manualCompareStatus="idle"
            manualCompareError={null}
            manualBenchmarkResult={null}
            manualBenchmarkStatus="loading"
            manualBenchmarkError={null}
            isBenchmarkPanelOpen
            isFindingsPanelOpen={false}
            onWaveSurferReady={() => undefined}
            onWaveSurferTimeUpdate={() => undefined}
            onWaveSurferFinish={() => undefined}
            onWaveSurferUserSelectionChange={() => undefined}
            onCloseComparisonPanel={() => undefined}
            onRerunCompare={() => undefined}
            onRerunBenchmark={() => undefined}
            onCloseBenchmarkPanel={() => undefined}
            onCloseFindingsPanel={() => undefined}
            onClearWaveformSelection={() => undefined}
            onZoomToSelection={() => undefined}
            onResetWaveformZoom={() => undefined}
            showInvestigationPrompt={false}
            onPromptOpenFindings={() => undefined}
            onPromptAddSpectrum={() => undefined}
            onPromptAddCpb={() => undefined}
            onPromptAddSoundQuality={() => undefined}
            onToolPanelFileSelect={() => undefined}
            onToolPanelToggleSpan={() => undefined}
            onToolPanelClose={() => undefined}
            onSeek={() => undefined}
            analysisResult={null}
            spectrumResult={null}
            findings={[]}
            findingsStatus="idle"
          />
        </MantineProvider>
      </Provider>,
    );

    expect(markup).toContain('Benchmarking files');
    expect(markup).toContain('Ranking files, detecting outliers, and preparing benchmark metrics.');
    expect(markup).toContain('role="status"');
  });
});
