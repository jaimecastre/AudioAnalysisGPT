import { useCallback, useState } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { callAgentAskEndpoint } from '../../agentAnalysis/services/agentAskService';
import { reportArtifactAdded } from '../../agentAnalysis/store/agentWorkspaceSlice';
import type { BatchBenchmarkFileRow, BatchBenchmarkResult } from '../types/batchBenchmarkTypes';

interface IUseBenchmarkReportReturn {
  generateReport: (result: BatchBenchmarkResult) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function buildBenchmarkPrompt(result: BatchBenchmarkResult): string {
  const fileCount = result.files.length;
  const outlierCount = result.outliers.length;

  // Detailed file metrics table
  const fileDetails = result.files
    .map((file) => {
      const sq = file.loudnessSone !== null
        ? `Loudness: ${file.loudnessSone.toFixed(2)} sone, Sharpness: ${file.sharpnessAcum?.toFixed(2)} acum, Roughness: ${file.roughnessAsper?.toFixed(3)} asper`
        : 'Sound quality: unavailable';
      return `File: ${file.fileName}
- RMS level: ${file.rmsDb.toFixed(2)} dB
- Peak level: ${file.peakDb.toFixed(2)} dB  
- Crest Factor: ${file.crestFactorDb.toFixed(2)} dB
- Dominant frequency: ${file.peakFrequencyHz.toFixed(0)} Hz
- Findings: ${file.findingCount} total (${file.highSeverityFindingCount} high severity)
- ${sq}`;
    })
    .join('\n\n');

  // Complete rankings (not just top 3)
  const rankingsDetail = result.rankings
    .map((ranking) => {
      const rankedFiles = ranking.fileIds
        .map((fileId, index) => {
          const file = result.files.find((f) => f.fileId === fileId);
          const value = getMetricValue(file, ranking.metric);
          return `  ${index + 1}. ${file?.fileName ?? fileId}: ${value}`;
        })
        .join('\n');
      return `${ranking.label} (${ranking.direction}):\n${rankedFiles}`;
    })
    .join('\n\n');

  // Detailed outliers with fence values
  const outliersDetail =
    outlierCount > 0
      ? result.outliers
          .map((outlier) => {
            const file = result.files.find((f) => f.fileId === outlier.fileId);
            const value = getMetricValue(file, outlier.metric);
            return `- ${file?.fileName ?? outlier.fileId}: ${outlier.label} = ${value} (fence: ${outlier.lowerFence.toFixed(2)} - ${outlier.upperFence.toFixed(2)})`;
          })
          .join('\n')
      : 'No statistical outliers detected.';

  // Detailed findings with titles
  const findingsDetail = result.files
    .filter((file) => file.topFindings.length > 0)
    .map((file) => {
      const findings = file.topFindings
        .map((f) => `  - [${f.severity}] ${f.title}`)
        .join('\n');
      return `${file.fileName}:\n${findings}`;
    })
    .join('\n\n');

  // Calculate some deltas for comparison
  const sortedByRms = [...result.files].sort((a, b) => b.rmsDb - a.rmsDb);
  const rmsRange = sortedByRms[0].rmsDb - sortedByRms[sortedByRms.length - 1].rmsDb;

  return `Generate an acoustic engineering analysis report from this batch benchmark dataset.

## Files Analyzed (${fileCount})
${fileDetails}

## Complete Rankings by Metric
${rankingsDetail}

## Statistical Outliers (${outlierCount} detected)
${outliersDetail}

## Key Findings
${findingsDetail || 'No findings detected in any files.'}

## Key Comparisons
- RMS range across files: ${rmsRange.toFixed(2)} dB (${sortedByRms[0].fileName} highest, ${sortedByRms[sortedByRms.length - 1].fileName} lowest)
- Dynamic range (crest factor): ${Math.max(...result.files.map((f) => f.crestFactorDb)).toFixed(2)} dB max

## Methodology Notes
${result.limitations.filter((l) => !l.toLowerCase().includes('spl')).length > 0 
  ? result.limitations.filter((l) => !l.toLowerCase().includes('spl')).map((l) => `- ${l}`).join('\n') 
  : 'Standard analysis pipeline.'}

Write a specific, technical report that:
1. Opens with the most significant finding (outlier, ranking, or issue)
2. Compares specific files with actual dB values (e.g., "File X is 3.2 dB louder than File Y")
3. Explains what the outliers mean in engineering terms (e.g., "The 6.8 dB RMS outlier indicates...")
4. Identifies which files need attention and why
5. Recommends specific next analyses (not generic advice)

Be precise with numbers. Avoid vague language like "some files" or "certain metrics" - name the specific files and values.`;
}

function getMetricValue(file: BatchBenchmarkFileRow | undefined, metric: string): string {
  if (!file) return 'N/A';
  switch (metric) {
    case 'rmsDb':
      return `${file.rmsDb.toFixed(2)} dB RMS`;
    case 'peakDb':
      return `${file.peakDb.toFixed(2)} dB peak`;
    case 'crestFactorDb':
      return `${file.crestFactorDb.toFixed(2)} dB crest`;
    case 'loudnessSone':
      return file.loudnessSone !== null ? `${file.loudnessSone.toFixed(2)} sone` : 'N/A';
    case 'sharpnessAcum':
      return file.sharpnessAcum !== null ? `${file.sharpnessAcum.toFixed(2)} acum` : 'N/A';
    case 'roughnessAsper':
      return file.roughnessAsper !== null ? `${file.roughnessAsper.toFixed(3)} asper` : 'N/A';
    case 'findingCount':
      return `${file.findingCount} findings`;
    default:
      return 'N/A';
  }
}

export function useBenchmarkReport(): IUseBenchmarkReportReturn {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(
    async (result: BatchBenchmarkResult): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const prompt = buildBenchmarkPrompt(result);
        const fileIds = result.files.map((f) => f.fileId);

        const response = await callAgentAskEndpoint({
          question: prompt,
          selectedFileIds: fileIds,
          conversationContext: [],
        });

        const reportArtifact = {
          type: 'report' as const,
          id: `benchmark-report-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: `Batch Benchmark Report (${result.files.length} files)`,
          markdownContent: response.answer,
        };

        dispatch(reportArtifactAdded(reportArtifact));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate report';
        setError(errorMessage);

        const errorReport = {
          type: 'report' as const,
          id: `benchmark-report-error-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: `Batch Benchmark Report (Error)`,
          markdownContent: `## Report Generation Failed\n\n${errorMessage}\n\nPlease try again or check your connection.`,
        };

        dispatch(reportArtifactAdded(errorReport));
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch],
  );

  return {
    generateReport,
    isLoading,
    error,
  };
}
