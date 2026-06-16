import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { ActionIcon, Progress, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFileText, IconRobot, IconRotateClockwise2, IconX, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import { agentPromptPrefillSet, setActiveMode } from '../../navigation/store/navigationSlice';
import type { BatchBenchmarkFileRow, BatchBenchmarkResult } from '../types/batchBenchmarkTypes';
import { benchmarkProgressSelector } from '../store/batchBenchmarkSlice';
import {
  type BenchmarkSortKey,
  type BenchmarkSortState,
  formatDb,
  formatDbFs,
  formatFrequencyHz,
  formatTonalPeak,
  formatUnitValue,
  sortBenchmarkRows,
} from '../utils/benchmarkFormatting';
import { BenchmarkRankingsCard } from './BenchmarkRankingsCard';
import { BenchmarkOutliersCard } from './BenchmarkOutliersCard';
import { useBenchmarkReport } from '../hooks/useBenchmarkReport';
import styles from './BatchBenchmarkPanel.module.scss';

interface IBatchBenchmarkPanelProps {
  result: BatchBenchmarkResult | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  onClose: () => void;
  onRerun: () => void;
}

type HeaderDefinition = {
  key: BenchmarkSortKey;
  label: string;
  tooltip: string;
  numeric: boolean;
};

const HEADERS: HeaderDefinition[] = [
  { key: 'fileName', label: 'File', tooltip: 'Loaded audio file', numeric: false },
  { key: 'rmsDb', label: 'RMS', tooltip: 'Root mean square level in dB SPL', numeric: true },
  { key: 'peakDb', label: 'Peak', tooltip: 'Peak sample level in dB SPL', numeric: true },
  { key: 'crestFactorDb', label: 'Crest', tooltip: 'Peak-to-RMS crest factor in dB', numeric: true },
  { key: 'peakFrequencyHz', label: 'Peak freq', tooltip: 'Strongest spectrum bin frequency', numeric: true },
  { key: 'findingCount', label: 'Findings', tooltip: 'Detected acoustic findings', numeric: true },
  { key: 'strongestTonalPeakProminenceDb', label: 'Tonal peak', tooltip: 'Strongest tonal peak frequency and prominence', numeric: true },
  { key: 'loudnessSone', label: 'Loudness', tooltip: 'Stationary loudness in sone', numeric: true },
  { key: 'sharpnessAcum', label: 'Sharpness', tooltip: 'Sharpness in acum', numeric: true },
  { key: 'roughnessAsper', label: 'Roughness', tooltip: 'Roughness in asper', numeric: true },
  { key: 'attention', label: 'Flags', tooltip: 'Findings, unavailable metrics, and statistical outliers', numeric: false },
];

export const BatchBenchmarkPanel = ({
  result,
  status,
  error,
  onClose,
  onRerun,
}: IBatchBenchmarkPanelProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const progress = useAppSelector(benchmarkProgressSelector);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<BenchmarkSortState>({
    key: 'attention',
    direction: 'descending',
  });
  const [isTableVisible, setIsTableVisible] = useState(true);
  const { generateReport, isLoading: isReportLoading } = useBenchmarkReport();

  const sortedRows = useMemo(() => {
    return sortBenchmarkRows(result?.files ?? [], sortState);
  }, [result?.files, sortState]);

  function handleSort(key: BenchmarkSortKey): void {
    setSortState((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'ascending' ? 'descending' : 'ascending',
        };
      }

      return {
        key,
        direction: key === 'fileName' ? 'ascending' : 'descending',
      };
    });
  }

  function handleToggleExpanded(fileId: string): void {
    setExpandedFileIds((previous) => {
      const next = new Set(previous);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  function handleExplainBenchmark(): void {
    dispatch(agentPromptPrefillSet('Explain this batch benchmark. Which files need attention, what measured metrics drive the ranking, and what follow-up analysis should I run?'));
    dispatch(setActiveMode('agent'));
  }

  function handleGenerateReport(): void {
    if (result) {
      void generateReport(result);
    }
  }

  return (
    <section className={styles.panel} aria-label="Batch benchmark results">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Batch benchmark</h2>
          <p className={styles.subtitle}>Rank loaded files by measured acoustic facts</p>
        </div>
        <div className={styles.headerActions}>
          {result && (
            <Tooltip
              label={isTableVisible ? 'Hide data table' : 'Show data table'}
              withArrow
              position="bottom"
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setIsTableVisible(!isTableVisible)}
                aria-label={isTableVisible ? 'Hide table' : 'Show table'}
              >
                {isTableVisible ? (
                  <IconLayoutSidebarLeftCollapse size={16} />
                ) : (
                  <IconLayoutSidebarLeftExpand size={16} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
          <button
            type="button"
            className={styles.explainButton}
            onClick={onRerun}
            disabled={status === 'loading'}
          >
            <IconRotateClockwise2 size={14} />
            Re-run benchmark
          </button>
          <button
            type="button"
            className={styles.explainButton}
            onClick={handleExplainBenchmark}
            disabled={!result || status === 'loading'}
          >
            <IconRobot size={14} />
            Explain benchmark
          </button>
          <button
            type="button"
            className={styles.explainButton}
            onClick={handleGenerateReport}
            disabled={!result || status === 'loading' || isReportLoading}
          >
            <IconFileText size={14} />
            {isReportLoading ? 'Generating...' : 'Generate report'}
          </button>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={onClose}
            aria-label="Close benchmark panel"
          >
            <IconX size={12} />
          </ActionIcon>
        </div>
      </div>

      {status === 'loading' && (
        <div className={styles.progressStrip}>
          <Progress
            value={progress !== null ? Math.round((progress.completed / progress.total) * 100) : 0}
            size="xs"
            animated
            className={styles.progressBar}
          />
          <span className={styles.progressLabel}>
            {progress !== null
              ? `${progress.completed}/${progress.total} — ${progress.fileName}`
              : 'Starting…'}
          </span>
        </div>
      )}

      {status === 'error' && error !== null && (
        <div className={styles.errorStrip}>{error}</div>
      )}

      {result && result.limitations.length > 0 && (
        <div className={styles.limitationsStrip}>
          {result.limitations.map((limitation) => (
            <span key={limitation} className={styles.limitationChip}>{limitation}</span>
          ))}
        </div>
      )}

      <div className={styles.contentGrid}>
        {isTableVisible && (
          <div className={styles.tableSection}>
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.expandHeader} aria-label="Expand row" />
                    {HEADERS.map((header) => (
                      <th
                        key={header.key}
                        className={`${header.numeric ? styles.numericHeader : ''} ${header.key === 'fileName' ? styles.fileHeader : ''}`}
                      >
                        <Tooltip label={header.tooltip} withArrow position="top">
                          <button
                            type="button"
                            className={styles.sortButton}
                            onClick={() => handleSort(header.key)}
                          >
                            <span>{header.label}</span>
                            <span className={styles.sortIndicator}>
                              {sortState.key === header.key ? (sortState.direction === 'ascending' ? '↑' : '↓') : ''}
                            </span>
                          </button>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status === 'loading' && !result && <SkeletonRows />}
                  {sortedRows.map((row) => (
                    <BenchmarkRow
                      key={row.fileId}
                      row={row}
                      isExpanded={expandedFileIds.has(row.fileId)}
                      onToggleExpanded={handleToggleExpanded}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className={styles.cardsSection}>
            <BenchmarkRankingsCard rankings={result.rankings} files={result.files} />
            <BenchmarkOutliersCard outliers={result.outliers} files={result.files} />
          </div>
        )}
      </div>
    </section>
  );
};

interface IBenchmarkRowProps {
  row: BatchBenchmarkFileRow;
  isExpanded: boolean;
  onToggleExpanded: (fileId: string) => void;
}

const BenchmarkRow = ({ row, isExpanded, onToggleExpanded }: IBenchmarkRowProps): JSX.Element => {
  return (
    <>
      <tr className={styles.dataRow}>
        <td className={styles.expandCell}>
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => onToggleExpanded(row.fileId)}
            aria-label={isExpanded ? `Collapse ${row.fileName}` : `Expand ${row.fileName}`}
          >
            {isExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
          </button>
        </td>
        <th scope="row" className={styles.fileCell} title={row.fileName}>{row.fileName}</th>
        <td className={styles.numericCell}>{formatDbFs(row.rmsDb, row.dbUnit)}</td>
        <td className={styles.numericCell}>{formatDbFs(row.peakDb, row.dbUnit)}</td>
        <td className={styles.numericCell}>{formatDb(row.crestFactorDb)}</td>
        <td className={styles.numericCell}>{formatFrequencyHz(row.peakFrequencyHz)}</td>
        <td className={styles.numericCell}>
          <span className={row.highSeverityFindingCount > 0 ? styles.findingHot : ''}>
            {row.findingCount}
          </span>
        </td>
        <td className={styles.numericCell}>{formatTonalPeak(row)}</td>
        <td className={styles.numericCell}>{formatUnitValue(row.loudnessSone, 'sone')}</td>
        <td className={styles.numericCell}>{formatUnitValue(row.sharpnessAcum, 'acum')}</td>
        <td className={styles.numericCell}>{formatUnitValue(row.roughnessAsper, 'asper')}</td>
        <td className={styles.flagCell}>
          {row.flagLabels.length === 0 && <span className={styles.muted}>—</span>}
          {row.flagLabels.map((flag) => (
            <span key={flag} className={styles.flagChip}>{flag}</span>
          ))}
        </td>
      </tr>
      {isExpanded && (
        <tr className={styles.detailRow}>
          <td />
          <td colSpan={HEADERS.length} className={styles.detailCell}>
            <div className={styles.detailGrid}>
              <div>
                <span className={styles.detailLabel}>Region</span>
                <span className={styles.detailValue}>
                  {row.regionStartSeconds.toFixed(3)}s - {row.regionEndSeconds.toFixed(3)}s
                </span>
              </div>
              <div>
                <span className={styles.detailLabel}>Sound quality</span>
                <span className={styles.detailValue}>
                  {row.soundQualityUnavailableReason ?? 'Available'}
                </span>
              </div>
              <div className={styles.findingDetail}>
                <span className={styles.detailLabel}>Top findings</span>
                {row.topFindings.length === 0 && <span className={styles.detailValue}>No findings</span>}
                {row.topFindings.map((finding) => (
                  <span key={finding.findingId} className={styles.detailValue}>
                    {finding.severity.toUpperCase()} · {finding.title}
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const SkeletonRows = (): JSX.Element => {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <tr key={index} className={styles.skeletonRow}>
          <td colSpan={HEADERS.length + 1}>
            <span className={styles.skeletonBar} />
          </td>
        </tr>
      ))}
    </>
  );
};
