import type { JSX } from 'react';
import { useRef, useEffect } from 'react';
import { IconArrowRight, IconFileMusic, IconAlignBoxLeftMiddle } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../store/reduxHooks';
import { agentArtifactsSelector } from './agentWorkspaceSlice';
import type {
  AgentArtifact,
  AgentArtifactAnalysis,
  AgentArtifactMarker,
  AgentArtifactSelection,
} from './agentWorkspaceSlice';
import { setActiveMode } from '../navigation/navigationSlice';
import { activeSelectionSelector } from '../waveform/waveformSelectionSlice';
import { projectFilesSelector, selectedSignalIdSelector } from '../project/projectSlice';
import styles from './AgentWorkspacePanel.module.scss';

function WorkspaceContextCard(): JSX.Element | null {
  const files = useAppSelector(projectFilesSelector);
  const selectedSignalId = useAppSelector(selectedSignalIdSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);

  const activeFile = files.find((file) => file.id === selectedSignalId) ?? null;

  if (!activeFile) return null;

  const hasValidSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  return (
    <div className={styles.contextCard}>
      <div className={styles.contextRow}>
        <IconFileMusic size={12} className={styles.contextIcon} />
        <span className={styles.contextFileName} title={activeFile.name}>{activeFile.name}</span>
      </div>
      <div className={styles.contextMeta}>
        {activeFile.sampleRate / 1000}kHz
        {' · '}{activeFile.channels}ch
        {activeFile.bitDepth ? ` · ${activeFile.bitDepth}bit` : ''}
      </div>
      {hasValidSelection && activeSelection && (
        <div className={styles.contextRow}>
          <IconAlignBoxLeftMiddle size={12} className={styles.contextSelectionIcon} />
          <span className={styles.contextSelectionLabel}>
            {activeSelection.startSeconds.toFixed(3)}s
            {' – '}
            {activeSelection.endSeconds.toFixed(3)}s
            {' ('}{(activeSelection.endSeconds - activeSelection.startSeconds).toFixed(3)}s{')'}
          </span>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function AnalysisCard({ artifact }: { artifact: AgentArtifactAnalysis }): JSX.Element {
  const dispatch = useAppDispatch();
  const result = artifact.result;

  const displayEntries = Object.entries(result.summary)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 6);

  const kindLabel = result.kind === 'file_info' ? 'File Info' : result.kind === 'level' ? 'Level' : 'Spectrum';

  const handleOpenInManual = (): void => {
    dispatch(setActiveMode('manual'));
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardKindTag}>{kindLabel}</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        {displayEntries.map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          const rawValue = typeof value === 'number'
            ? (Number.isInteger(value) ? String(value) : (value as number).toFixed(4))
            : String(value);
          const isHighlighted = key.toLowerCase().includes('peak') || key.toLowerCase().includes('rms');
          return (
            <div key={key} className={styles.metricRow}>
              <span className={styles.metricLabel}>{formattedKey}</span>
              <span className={`${styles.metricValue} ${isHighlighted ? styles.metricValueHighlight : ''}`}>
                {rawValue}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.openInManualButton}
          onClick={handleOpenInManual}
          title="Switch to Manual Mode to inspect this result"
        >
          Open in Manual Mode <IconArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

function MarkerCard({ artifact }: { artifact: AgentArtifactMarker }): JSX.Element {
  return (
    <div className={`${styles.card} ${styles.cardMarker}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagMarker}`}>Marker</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>label</span>
          <span className={styles.metricValue}>{artifact.label}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>time</span>
          <span className={`${styles.metricValue} ${styles.metricValueHighlight}`}>
            {artifact.timeSeconds.toFixed(3)}s
          </span>
        </div>
      </div>
    </div>
  );
}

function SelectionCard({ artifact }: { artifact: AgentArtifactSelection }): JSX.Element {
  const durationSeconds = artifact.endSeconds - artifact.startSeconds;
  return (
    <div className={`${styles.card} ${styles.cardSelection}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagSelection}`}>Selection</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>start</span>
          <span className={styles.metricValue}>{artifact.startSeconds.toFixed(3)}s</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>end</span>
          <span className={styles.metricValue}>{artifact.endSeconds.toFixed(3)}s</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>duration</span>
          <span className={`${styles.metricValue} ${styles.metricValueHighlight}`}>
            {durationSeconds.toFixed(3)}s
          </span>
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: AgentArtifact }): JSX.Element {
  if (artifact.type === 'analysis_result') {
    return <AnalysisCard artifact={artifact} />;
  }
  if (artifact.type === 'marker_added') {
    return <MarkerCard artifact={artifact} />;
  }
  if (artifact.type === 'selection_set') {
    return <SelectionCard artifact={artifact} />;
  }
  return <></>;
}

export function AgentWorkspacePanel(): JSX.Element {
  const artifacts = useAppSelector(agentArtifactsSelector);
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [artifacts]);

  const hasArtifacts = artifacts.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Workspace</span>
      </div>
      <WorkspaceContextCard />
      <div className={styles.artifactFeed} ref={feedRef}>
        {!hasArtifacts && (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              Analysis results, markers, and selections the agent creates will appear here.
            </p>
          </div>
        )}
        {artifacts.map((artifact) => (
          <ArtifactCard key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </div>
  );
}
