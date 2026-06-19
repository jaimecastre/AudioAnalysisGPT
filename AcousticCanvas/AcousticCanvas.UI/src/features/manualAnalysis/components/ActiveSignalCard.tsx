import type { JSX, RefObject } from 'react';
import { Text, Group, ActionIcon } from '@mantine/core';
import { IconX, IconGitCompare } from '@tabler/icons-react';
import { WaveSurferDisplay } from '../../waveform/components/WaveSurferDisplay';
import type { WaveSurferDisplayRef } from '../../waveform/components/WaveSurferDisplay';
import { InvestigationStartPrompt } from './InvestigationStartPrompt';
import { ComparisonView } from '../../comparison/components/ComparisonView';
import { BatchBenchmarkPanel } from '../../batchBenchmark';
import { FindingsPanel } from '../../findings/components/FindingsPanel';
import { SpectrogramPanel } from '../../analysis/components/SpectrogramPanel';
import { SpectrumPanel } from '../../analysis/components/SpectrumPanel';
import { CpbPanel } from '../../analysis/components/CpbPanel';
import { SoundQualityPanel } from '../../analysis/components/SoundQualityPanel';
import type { CompareResult } from '../../agent/types/agentToolTypes';
import type { AnalysisResult } from '../../analysis/types/analysisTypes';
import type { SpectrumPointsResponse } from '../../analysis/types/spectrumTypes';
import { KeyFindingsSummary } from './KeyFindingsSummary';
import type { BatchBenchmarkResult } from '../../batchBenchmark';
import type { AudioFile } from '../../../store/projectState';
import type { WaveformSelection } from '../../waveform/store/waveformSelectionSlice';
import type { Finding } from '../../findings/types/findingsTypes';
import type { FindingsStatus } from '../../findings/store/findingsSlice';
import styles from './ActiveSignalCard.module.scss';

interface IToolPanel {
  id: string;
  type: 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
  fileId: string | null;
  span: 'normal' | 'wide';
}

interface IActiveSignalCardProps {
  file: AudioFile;
  audioUrl: string;
  waveSurferRef: RefObject<WaveSurferDisplayRef | null>;
  currentTime: number | null;
  activeSelection: WaveformSelection | null;
  toolPanels: IToolPanel[];
  allFiles: AudioFile[];
  manualCompareResult: CompareResult | null;
  manualCompareStatus: 'idle' | 'loading' | 'error';
  manualCompareError: string | null;
  manualBenchmarkResult: BatchBenchmarkResult | null;
  manualBenchmarkStatus: 'idle' | 'loading' | 'error';
  manualBenchmarkError: string | null;
  isBenchmarkPanelOpen: boolean;
  isFindingsPanelOpen: boolean;
  onWaveSurferReady: (audioDuration: number) => void;
  onWaveSurferTimeUpdate: (time: number) => void;
  onWaveSurferFinish: () => void;
  onWaveSurferUserSelectionChange: (startSeconds: number, endSeconds: number) => void;
  onCloseComparisonPanel: () => void;
  onRerunCompare: () => void;
  onRerunBenchmark: () => void;
  onCloseBenchmarkPanel: () => void;
  onCloseFindingsPanel: () => void;
  showInvestigationPrompt: boolean;
  onPromptOpenFindings: () => void;
  onPromptAddSpectrum: () => void;
  onPromptAddSoundQuality: () => void;
  onToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
  onToolPanelToggleSpan: (panelId: string) => void;
  onToolPanelClose: (panelId: string) => void;
  onSeek: (timeSeconds: number) => void;
  analysisResult: AnalysisResult | null;
  spectrumResult: SpectrumPointsResponse | null;
  findings: Finding[];
  findingsStatus: FindingsStatus;
}

export function ActiveSignalCard({
  file,
  audioUrl,
  waveSurferRef,
  currentTime,
  activeSelection,
  toolPanels,
  allFiles,
  manualCompareResult,
  manualCompareStatus,
  manualCompareError,
  manualBenchmarkResult,
  manualBenchmarkStatus,
  manualBenchmarkError,
  isBenchmarkPanelOpen,
  isFindingsPanelOpen,
  onWaveSurferReady,
  onWaveSurferTimeUpdate,
  onWaveSurferFinish,
  onWaveSurferUserSelectionChange,
  onCloseComparisonPanel,
  onRerunCompare,
  onRerunBenchmark,
  onCloseBenchmarkPanel,
  onCloseFindingsPanel,
  showInvestigationPrompt,
  analysisResult,
  spectrumResult,
  findings,
  findingsStatus,
  onPromptOpenFindings,
  onPromptAddSpectrum,
  onPromptAddSoundQuality,
  onToolPanelFileSelect,
  onToolPanelToggleSpan,
  onToolPanelClose,
  onSeek,
}: IActiveSignalCardProps): JSX.Element {
  return (
    <div className={`${styles.signalCard} ${styles.signalCardSelected}`}>
      <div className={styles.signalCardHeader}>
        <span className={styles.signalCardLabel}>{file.name}</span>
      </div>
      <div className={styles.signalCardBody}>
        <WaveSurferDisplay
          fileId={file.id}
          audioUrl={audioUrl}
          onReady={onWaveSurferReady}
          onTimeUpdate={onWaveSurferTimeUpdate}
          onFinish={onWaveSurferFinish}
          onUserSelectionChange={onWaveSurferUserSelectionChange}
          displayRef={waveSurferRef}
        />
      </div>

      <KeyFindingsSummary
        activeFile={file}
        analysisResult={analysisResult}
        spectrumResult={spectrumResult}
        findings={findings}
        findingsStatus={findingsStatus}
        onViewFindings={onPromptOpenFindings}
        onAnalyzeLoudestRegion={onPromptOpenFindings}
        onInspectSpectrum={onPromptAddSpectrum}
      />

      <div className={styles.analysisGrid}>
      {showInvestigationPrompt && (
        <InvestigationStartPrompt
          onOpenFindings={onPromptOpenFindings}
          onAddSpectrum={onPromptAddSpectrum}
          onAddSoundQuality={onPromptAddSoundQuality}
        />
      )}
      {manualCompareResult !== null && (
        <div className={`${styles.comparisonPanel} ${styles.gridSpanFull}`}>
          <div className={styles.comparisonPanelHeader}>
            <span className={styles.comparisonPanelTitle}>A/B Comparison</span>
            <Group gap={4}>
              <ActionIcon
                variant="subtle"
                color="blue"
                size="xs"
                onClick={onRerunCompare}
                aria-label="Change files and re-run comparison"
                title="Change files"
              >
                <IconGitCompare size={12} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={onCloseComparisonPanel}
                aria-label="Close comparison panel"
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>
          </div>
          {manualCompareStatus === 'error' && (
            <div className={styles.comparisonPanelError}>{manualCompareError}</div>
          )}
          <ComparisonView result={manualCompareResult} />
        </div>
      )}

      {isBenchmarkPanelOpen && (
        <div className={styles.gridSpanFull}>
          <BatchBenchmarkPanel
            result={manualBenchmarkResult}
            status={manualBenchmarkStatus}
            error={manualBenchmarkError}
            onRerun={onRerunBenchmark}
            onClose={onCloseBenchmarkPanel}
          />
        </div>
      )}

      {isFindingsPanelOpen && (
        <div className={styles.gridSpanFull}>
          <FindingsPanel
            fileId={file.id}
            onClose={onCloseFindingsPanel}
          />
        </div>
      )}

      {toolPanels.map((panel) => {
        const isWide = panel.span === 'wide';
        const wrapperClassName = isWide ? styles.gridSpanFull : undefined;

        let panelElement: JSX.Element;
        if (panel.type === 'spectrogram') {
          panelElement = (
            <SpectrogramPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              currentTimeSeconds={currentTime ?? 0}
              onSeek={onSeek}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else if (panel.type === 'cpb') {
          panelElement = (
            <CpbPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else if (panel.type === 'soundQuality') {
          panelElement = (
            <SoundQualityPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        } else {
          panelElement = (
            <SpectrumPanel
              panelId={panel.id}
              availableFiles={allFiles}
              selectedFileId={panel.fileId}
              onFileSelect={onToolPanelFileSelect}
              onClose={onToolPanelClose}
              isWide={isWide}
              onToggleSpan={onToolPanelToggleSpan}
            />
          );
        }

        return (
          <div key={panel.id} className={wrapperClassName}>
            {panelElement}
          </div>
        );
      })}
      </div>

      {activeSelection && activeSelection.endSeconds > activeSelection.startSeconds && (
        <div className={styles.regionInfoBar}>
          <Group gap="xs">
            <Text size="xs" c="dimmed">Region:</Text>
            <Text size="xs" fw={500}>
              {activeSelection.startSeconds.toFixed(3)}s – {activeSelection.endSeconds.toFixed(3)}s
            </Text>
            <Text size="xs" c="dimmed">
              ({(activeSelection.endSeconds - activeSelection.startSeconds).toFixed(3)}s)
            </Text>
          </Group>
        </div>
      )}
    </div>
  );
}
