import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { ActionIcon, Collapse } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type {
  BatchBenchmarkFileRow,
  BatchBenchmarkOutlier,
} from '../types/batchBenchmarkTypes';
import {
  formatDb,
  formatDbFs,
  formatUnitValue,
} from '../utils/benchmarkFormatting';
import styles from './BenchmarkOutliersCard.module.scss';

interface IBenchmarkOutliersCardProps {
  outliers: BatchBenchmarkOutlier[];
  files: BatchBenchmarkFileRow[];
}

interface IGroupedOutliers {
  metric: string;
  label: string;
  items: BatchBenchmarkOutlier[];
}

const METRIC_LABELS: Record<string, string> = {
  rmsDb: 'RMS Level',
  peakDb: 'Peak Level',
  crestFactorDb: 'Crest Factor',
  sharpnessAcum: 'Sharpness',
  roughnessAsper: 'Roughness',
  findingCount: 'Findings',
  strongestTonalPeakProminenceDb: 'Tonal Peak',
};

function formatOutlierValue(outlier: BatchBenchmarkOutlier): string {
  const file = outlier;
  switch (outlier.metric) {
    case 'rmsDb':
      return formatDbFs(file.value, 'dB');
    case 'peakDb':
      return formatDbFs(file.value, 'dB');
    case 'crestFactorDb':
      return formatDb(file.value);
    case 'sharpnessAcum':
      return formatUnitValue(file.value, 'acum');
    case 'roughnessAsper':
      return formatUnitValue(file.value, 'asper');
    case 'findingCount':
      return `${Math.round(file.value)} findings`;
    case 'strongestTonalPeakProminenceDb':
      return formatDb(file.value);
    default:
      return file.value.toFixed(2);
  }
}

function groupOutliersByMetric(outliers: BatchBenchmarkOutlier[]): IGroupedOutliers[] {
  const groups = new Map<string, BatchBenchmarkOutlier[]>();

  for (const outlier of outliers) {
    const existing = groups.get(outlier.metric) ?? [];
    existing.push(outlier);
    groups.set(outlier.metric, existing);
  }

  return Array.from(groups.entries()).map(([metric, items]) => ({
    metric,
    label: METRIC_LABELS[metric] ?? metric,
    items,
  }));
}

function getFileName(files: BatchBenchmarkFileRow[], fileId: string): string {
  return files.find((f) => f.fileId === fileId)?.fileName ?? fileId;
}

function OutlierExplanation(): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={styles.explanation}>
      <button
        type="button"
        className={styles.explanationToggle}
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <IconInfoCircle size={12} />
        <span>About outliers</span>
        <span className={styles.expandIcon}>
          {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </span>
      </button>

      <Collapse expanded={isExpanded}>
        <p className={styles.explanationText}>
          Outliers are detected using the IQR (Interquartile Range) method. Values outside
          1.5× the IQR from the first or third quartile are flagged as statistical outliers.
          At least 4 files are required for outlier detection.
        </p>
      </Collapse>
    </div>
  );
}

function MetricOutlierGroup({
  group,
  files,
}: {
  group: IGroupedOutliers;
  files: BatchBenchmarkFileRow[];
}): JSX.Element {
  return (
    <div className={styles.outlierGroup}>
      <div className={styles.outlierGroupHeader}>{group.label}</div>
      <div className={styles.outlierList}>
        {group.items.map((outlier) => {
          const fileName = getFileName(files, outlier.fileId);
          const fenceLabel = outlier.direction === 'high' ? 'Upper fence' : 'Lower fence';
          const fenceValue = outlier.direction === 'high' ? outlier.upperFence : outlier.lowerFence;
          const percentDiff = Math.abs(((outlier.value - fenceValue) / Math.abs(fenceValue)) * 100);

          return (
            <div key={`${outlier.fileId}-${outlier.metric}`} className={styles.outlierItem}>
              <div className={styles.outlierMain}>
                <span
                  className={`${styles.directionBadge} ${outlier.direction === 'high' ? styles.high : styles.low}`}
                >
                  {outlier.direction === 'high' ? '↑' : '↓'}
                </span>
                <span className={styles.fileName} title={fileName}>
                  {fileName}
                </span>
                <span className={styles.metricValue}>{formatOutlierValue(outlier)}</span>
              </div>
              <div className={styles.outlierContext}>
                <span className={styles.fenceInfo}>
                  {fenceLabel}: {formatOutlierValue({ ...outlier, value: fenceValue })}
                </span>
                <span className={styles.percentDiff}>+{percentDiff.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BenchmarkOutliersCard({
  outliers,
  files,
}: IBenchmarkOutliersCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const groupedOutliers = groupOutliersByMetric(outliers);
  const hasOutliers = outliers.length > 0;

  return (
    <div className={`${styles.card} ${hasOutliers ? styles.hasOutliers : ''}`}>
      <div className={styles.cardHeader}>
        <IconAlertTriangle
          size={18}
          className={hasOutliers ? styles.headerIconAlert : styles.headerIcon}
        />
        <h3 className={styles.headerTitle}>Outliers</h3>
        {hasOutliers && (
          <span className={styles.headerBadge}>{outliers.length} found</span>
        )}
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          onClick={handleToggle}
          aria-label={isExpanded ? 'Collapse outliers' : 'Expand outliers'}
          className={styles.expandButton}
        >
          {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </ActionIcon>
      </div>

      <Collapse expanded={isExpanded}>
        <div className={styles.content}>
          {!hasOutliers && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✓</span>
              <p className={styles.emptyText}>No statistical outliers detected</p>
              {files.length < 4 && (
                <p className={styles.emptyHint}>At least 4 files required for outlier detection</p>
              )}
            </div>
          )}

          {hasOutliers && (
            <>
              <div className={styles.outlierGroups}>
                {groupedOutliers.map((group) => (
                  <MetricOutlierGroup key={group.metric} group={group} files={files} />
                ))}
              </div>
              <OutlierExplanation />
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
}
