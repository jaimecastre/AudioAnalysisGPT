import type { JSX } from 'react';
import { Group, Loader, Text } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import type { SoundQualitySummaryResult } from '../hooks/useSoundQualitySummary';
import styles from './SoundQualitySummary.module.scss';

interface ISoundQualitySummaryProps {
  summary: SoundQualitySummaryResult | null;
  isLoading: boolean;
  error: string | null;
}

function assessmentClass(assessment: string): string {
  if (assessment === 'Good') return styles.good;
  if (assessment === 'Fair') return styles.fair;
  return styles.poor;
}

export const SoundQualitySummary = ({ summary, isLoading, error }: ISoundQualitySummaryProps): JSX.Element => {
  if (isLoading) {
    return (
      <div className={styles.section}>
        <Group justify="center" gap={6}>
          <Loader size="xs" color="teal" />
          <Text size="xs" c="dimmed">Loading summary...</Text>
        </Group>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.section}>
        <Text size="xs" c="red">{error}</Text>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={styles.section}>
        <Text size="xs" c="dimmed">No summary available</Text>
      </div>
    );
  }

  const assessmentIcon = summary.overallAssessment === 'Good'
    ? <IconCheck size={11} />
    : summary.overallAssessment === 'Fair'
      ? <IconAlertTriangle size={11} />
      : <IconX size={11} />;

  return (
    <div className={styles.root}>
      <div className={styles.assessment}>
        <span className={styles.assessmentLabel}>Overall Assessment</span>
        <span className={`${styles.assessmentBadge} ${assessmentClass(summary.overallAssessment)}`}>
          {assessmentIcon}
          {summary.overallAssessment}
        </span>
      </div>

      {summary.keyFindings.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Key Findings</div>
          {summary.keyFindings.map((finding, index) => (
            <div key={index} className={styles.finding}>{finding}</div>
          ))}
        </div>
      )}

      {summary.topMetrics.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Top Metrics</div>
          {summary.topMetrics.map((metric) => (
            <div key={metric.name} className={styles.metricRow}>
              <span className={styles.metricName}>{metric.name}</span>
              <div className={styles.metricRight}>
                <span className={styles.metricValue}>{metric.value.toFixed(2)}</span>
                <span className={styles.metricUnit}>{metric.unit}</span>
                <span className={`${styles.metricBadge} ${assessmentClass(metric.assessment)}`}>
                  {metric.assessment}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.recommendations.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Recommendations</div>
          {summary.recommendations.map((recommendation, index) => (
            <div key={index} className={styles.recommendation}>{recommendation}</div>
          ))}
        </div>
      )}
    </div>
  );
};
