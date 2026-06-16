import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { ActionIcon, Collapse, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconTrophy } from '@tabler/icons-react';
import type {
  BatchBenchmarkFileRow,
  BatchBenchmarkRanking,
} from '../types/batchBenchmarkTypes';
import {
  formatDb,
  formatDbFs,
  formatUnitValue,
} from '../utils/benchmarkFormatting';
import styles from './BenchmarkRankingsCard.module.scss';

interface IBenchmarkRankingsCardProps {
  rankings: BatchBenchmarkRanking[];
  files: BatchBenchmarkFileRow[];
}

interface IRankingDisplayConfig {
  metric: string;
  title: string;
  isConcernWhenHigh: boolean;
  formatValue: (row: BatchBenchmarkFileRow) => string;
}

const RANKING_CONFIGS: IRankingDisplayConfig[] = [
  {
    metric: 'rmsDb',
    title: 'Loudest (RMS)',
    isConcernWhenHigh: false,
    formatValue: (row) => formatDbFs(row.rmsDb, row.dbUnit),
  },
  {
    metric: 'peakDb',
    title: 'Highest Peak',
    isConcernWhenHigh: false,
    formatValue: (row) => formatDbFs(row.peakDb, row.dbUnit),
  },
  {
    metric: 'crestFactorDb',
    title: 'Highest Crest Factor',
    isConcernWhenHigh: false,
    formatValue: (row) => formatDb(row.crestFactorDb),
  },
  {
    metric: 'sharpnessAcum',
    title: 'Sharpest',
    isConcernWhenHigh: true,
    formatValue: (row) => formatUnitValue(row.sharpnessAcum, 'acum'),
  },
  {
    metric: 'roughnessAsper',
    title: 'Roughest',
    isConcernWhenHigh: true,
    formatValue: (row) => formatUnitValue(row.roughnessAsper, 'asper'),
  },
  {
    metric: 'findingCount',
    title: 'Most Findings',
    isConcernWhenHigh: true,
    formatValue: (row) => `${row.findingCount} findings`,
  },
  {
    metric: 'strongestTonalPeakProminenceDb',
    title: 'Strongest Tonal Peak',
    isConcernWhenHigh: true,
    formatValue: (row) =>
      row.strongestTonalPeakProminenceDb !== null
        ? `${formatDb(row.strongestTonalPeakProminenceDb)} at ${row.strongestTonalPeakFrequencyHz?.toFixed(0)} Hz`
        : '—',
  },
];

const RANK_BADGES = ['🥇', '🥈', '🥉'];

function getFileById(
  files: BatchBenchmarkFileRow[],
  fileId: string,
): BatchBenchmarkFileRow | undefined {
  return files.find((file) => file.fileId === fileId);
}

function MetricRankingCard({
  config,
  ranking,
  files,
}: {
  config: IRankingDisplayConfig;
  ranking: BatchBenchmarkRanking;
  files: BatchBenchmarkFileRow[];
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const topThree = ranking.fileIds.slice(0, 3);

  return (
    <div
      className={`${styles.rankingCard} ${config.isConcernWhenHigh ? styles.concernRanking : ''}`}
    >
      <button
        type="button"
        className={styles.rankingHeader}
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <span className={styles.expandIcon}>
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span className={styles.rankingTitle}>{config.title}</span>
        <Tooltip
          label={config.isConcernWhenHigh ? 'Higher values may indicate issues' : 'Higher values are neutral'}
          withArrow
          position="top"
        >
          <span
            className={`${styles.concernIndicator} ${config.isConcernWhenHigh ? styles.isConcern : ''}`}
          >
            {config.isConcernWhenHigh ? '⚠️' : '•'}
          </span>
        </Tooltip>
      </button>

      <Collapse expanded={isExpanded}>
        <div className={styles.rankingList}>
          {topThree.map((fileId, index) => {
            const file = getFileById(files, fileId);
            if (!file) return null;

            return (
              <div key={fileId} className={styles.rankingItem}>
                <span className={styles.rankBadge}>{RANK_BADGES[index] ?? `#${index + 1}`}</span>
                <span className={styles.fileName} title={file.fileName}>
                  {file.fileName}
                </span>
                <span className={styles.metricValue}>{config.formatValue(file)}</span>
              </div>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

export function BenchmarkRankingsCard({
  rankings,
  files,
}: IBenchmarkRankingsCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const rankingsByMetric = new Map<string, BatchBenchmarkRanking>();
  for (const ranking of rankings) {
    rankingsByMetric.set(ranking.metric, ranking);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <IconTrophy size={18} className={styles.headerIcon} />
        <h3 className={styles.headerTitle}>Rankings</h3>
        <span className={styles.headerCount}>{rankings.length} metrics</span>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          onClick={handleToggle}
          aria-label={isExpanded ? 'Collapse all rankings' : 'Expand all rankings'}
          className={styles.expandAllButton}
        >
          {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </ActionIcon>
      </div>

      <Collapse expanded={isExpanded}>
        <div className={styles.rankingsContainer}>
          {RANKING_CONFIGS.map((config) => {
            const ranking = rankingsByMetric.get(config.metric);
            if (!ranking) return null;

            return (
              <MetricRankingCard
                key={config.metric}
                config={config}
                ranking={ranking}
                files={files}
              />
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}
