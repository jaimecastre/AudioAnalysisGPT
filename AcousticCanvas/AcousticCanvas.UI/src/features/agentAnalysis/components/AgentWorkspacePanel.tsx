import type { JSX } from 'react';
import { ComparisonView } from '../../comparison/components/ComparisonView';
import { IconArrowRight, IconFileMusic, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useAppDispatch } from '../../../store/reduxHooks';
import type {
  AgentArtifact,
  AgentArtifactAnalysis,
  AgentArtifactMarker,
  AgentArtifactSelection,
  AgentArtifactCompare,
  AgentArtifactFind,
  AgentArtifactFindings,
  AgentArtifactReport,
} from '../store/agentWorkspaceSlice';
import { setActiveMode } from '../../navigation/store/navigationSlice';
import { useWorkspaceContext } from '../hooks/useWorkspaceContext';
import { useArtifactFeed, useArtifactExpanded } from '../hooks/useArtifactFeed';
import { useRawDataDrawer } from '../hooks/useRawDataDrawer';
import { useReportCopy } from '../hooks/useReportCopy';
import styles from './AgentWorkspacePanel.module.scss';

function WorkspaceContextCard(): JSX.Element {
  const { files, activeFile } = useWorkspaceContext();

  return (
    <div className={styles.contextCard}>
      <div className={styles.contextHeading}>Imported files</div>
      {files.length === 0 && (
        <div className={styles.contextEmpty}>No loaded files</div>
      )}
      {files.map((file) => (
        <div key={file.id} className={styles.contextFileBlock}>
          <div className={styles.contextRow}>
            <IconFileMusic size={12} className={styles.contextIcon} />
            <span className={styles.contextFileName} title={file.name}>{file.name}</span>
            {activeFile?.id === file.id && <span className={styles.contextActiveTag}>active</span>}
          </div>
          <div className={styles.contextMeta}>
            {file.sampleRate / 1000}kHz
            {' · '}{file.channels}ch
            {file.bitDepth ? ` · ${file.bitDepth}bit` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function RawDataDrawer({ data }: { data: unknown }): JSX.Element {
  const { isExpanded, toggle } = useRawDataDrawer();
  const rawJson = JSON.stringify(data, null, 2);

  return (
    <div className={styles.rawDrawer}>
      <button
        type="button"
        className={styles.rawDrawerToggle}
        onClick={toggle}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
        Raw data
      </button>
      {isExpanded && (
        <pre className={styles.rawDrawerJson}>{rawJson}</pre>
      )}
    </div>
  );
}

function AnalysisCard({ artifact }: { artifact: AgentArtifactAnalysis }): JSX.Element {
  const dispatch = useAppDispatch();
  const result = artifact.result;

  const displayEntries = Object.entries(result.summary)
    .filter(([, value]) => value !== null && value !== undefined);

  const kindLabel = result.kind === 'file_info' ? 'File Info' : result.kind === 'level' ? 'Level' : 'Spectrum';
  const parameterEntries = Object.entries(result.parameters ?? {})
    .filter(([, value]) => value !== null && value !== undefined);

  const handleOpenInManual = (): void => {
    dispatch(setActiveMode('manual'));
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardKindTag}>{kindLabel}</span>
        {result.fromCache && <span className={styles.cachedTag}>Cached</span>}
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
        {parameterEntries.length > 0 && (
          <>
            <div className={styles.parameterHeading}>parameters</div>
            {parameterEntries.map(([key, value]) => {
              const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
              const rawValue = typeof value === 'number'
                ? (Number.isInteger(value) ? String(value) : value.toFixed(4))
                : String(value);
              return (
                <div key={`param-${key}`} className={styles.metricRow}>
                  <span className={styles.metricLabel}>{formattedKey}</span>
                  <span className={styles.metricValue}>{rawValue}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
      <RawDataDrawer data={result} />
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

function CompareCard({ artifact }: { artifact: AgentArtifactCompare }): JSX.Element {
  const result = artifact.result;

  return (
    <div className={`${styles.card} ${styles.cardCompare}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagCompare}`}>Compare</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.compareViewWrapper}>
        <ComparisonView result={result} />
      </div>
      <RawDataDrawer data={result} />
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

function getSeverityClass(severity: string): string {
  if (severity === 'high') return styles.severityHigh;
  if (severity === 'medium') return styles.severityMedium;
  return styles.severityLow;
}

function FindingsCard({ artifact }: { artifact: AgentArtifactFindings }): JSX.Element {
  const isExpanded = useArtifactExpanded(artifact.id);

  return (
    <div className={`${styles.card} ${styles.cardFindings}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagFindings}`}>Findings</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>issues found</span>
          <span className={`${styles.metricValue} ${styles.metricValueHighlight}`}>{artifact.findingCount}</span>
        </div>
        {!isExpanded && (
          <div className={styles.findingsCollapsedHint}>Click the Findings badge in the chat to see details</div>
        )}
        {isExpanded && artifact.findings.map((f) => (
          <div key={f.findingId} className={styles.findingRow}>
            <div className={styles.findingRowHeader}>
              <span className={`${styles.severityBadge} ${getSeverityClass(f.severity)}`}>{f.severity}</span>
              <span className={styles.findingType}>{f.type.replace(/_/g, ' ')}</span>
              {f.startSeconds !== null && f.endSeconds !== null && (
                <span className={styles.findingTime}>{f.startSeconds.toFixed(2)}s&ndash;{f.endSeconds.toFixed(2)}s</span>
              )}
              <span className={styles.findingConf}>{f.confidence}</span>
            </div>
            <div className={styles.findingTitle}>{f.title}</div>
            <div className={styles.findingDesc}>{f.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindCard({ artifact }: { artifact: AgentArtifactFind }): JSX.Element {
  const result = artifact.result;
  const kindLabel = result.kind
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
  const isClickCandidates = result.kind === 'click_candidate';

  return (
    <div className={`${styles.card} ${styles.cardFind}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagFind}`}>{kindLabel}</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>events found</span>
          <span className={`${styles.metricValue} ${styles.metricValueHighlight}`}>{result.eventCount}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>region</span>
          <span className={styles.metricValue}>
            {result.regionStartSeconds.toFixed(3)}s – {result.regionEndSeconds.toFixed(3)}s
          </span>
        </div>
        {result.events.slice(0, 5).map((event, index) => (
          <div key={index} className={styles.findEventRow}>
            <span className={styles.findEventTime}>{event.startSeconds.toFixed(3)}s</span>
            <span className={styles.findEventDesc}>
              {isClickCandidates
                ? event.description.replace('Transient onset', 'Click candidate')
                : event.description}
            </span>
          </div>
        ))}
        {result.eventCount > 5 && (
          <div className={styles.findEventMore}>+{result.eventCount - 5} more</div>
        )}
      </div>
      <RawDataDrawer data={result} />
    </div>
  );
}

function ReportCard({ artifact }: { artifact: AgentArtifactReport }): JSX.Element {
  const { copied, handleCopy } = useReportCopy(artifact.markdownContent);

  return (
    <div className={`${styles.card} ${styles.cardReport}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardKindTag} ${styles.cardKindTagReport}`}>Report</span>
        <span className={styles.cardTimestamp}>{formatTimestamp(artifact.timestamp)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.reportTitle}>{artifact.title}</div>
        <pre className={styles.reportPreview}>{artifact.markdownContent}</pre>
        <button
          type="button"
          className={styles.reportCopyButton}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy Markdown'}
        </button>
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
  if (artifact.type === 'compare_result') {
    return <CompareCard artifact={artifact} />;
  }
  if (artifact.type === 'find_result') {
    return <FindCard artifact={artifact} />;
  }
  if (artifact.type === 'findings_result') {
    return <FindingsCard artifact={artifact} />;
  }
  if (artifact.type === 'tool_result') {
    return <></>;
  }
  if (artifact.type === 'report') {
    return <ReportCard artifact={artifact} />;
  }
  return <></>;
}

export function AgentWorkspacePanel(): JSX.Element {
  const { artifacts, focusedArtifactId, feedRef, artifactRefs } = useArtifactFeed();
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
          <div
            key={artifact.id}
            ref={(el) => { artifactRefs.current[artifact.id] = el; }}
            className={artifact.id === focusedArtifactId ? styles.focusedArtifact : ''}
          >
            <ArtifactCard artifact={artifact} />
          </div>
        ))}
      </div>
    </div>
  );
}
