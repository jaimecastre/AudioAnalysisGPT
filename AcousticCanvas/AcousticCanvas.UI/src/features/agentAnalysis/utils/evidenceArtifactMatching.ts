import type { AgentArtifact } from '../store/agentWorkspaceSlice';
import type { AgentEvidenceItem } from './evidenceFormatting';

const TOOL_RESULT_BY_EVIDENCE_TYPE: Record<string, string> = {
  metadata: 'get_metadata',
  basic_metrics: 'run_basic_metrics',
  spectrum: 'run_spectrum',
  spectrogram: 'run_spectrogram',
  cpb: 'run_cpb',
  sound_quality: 'run_sound_quality_metrics',
};

export function getEvidenceArtifactId(
  evidenceItem: AgentEvidenceItem,
  artifacts: AgentArtifact[],
): string | null {
  if (evidenceItem.type === 'findings') {
    const fileId = typeof evidenceItem.data.fileId === 'string' ? evidenceItem.data.fileId : null;
    const matchingArtifact = artifacts.find((artifact) =>
      artifact.type === 'findings_result' && artifact.fileId === fileId);
    return matchingArtifact?.id ?? null;
  }

  if (evidenceItem.type === 'event_detection') {
    const matchingArtifact = artifacts.find((artifact) => artifact.type === 'find_result');
    return matchingArtifact?.id ?? null;
  }

  if (evidenceItem.type.includes('comparison')) {
    const matchingArtifact = artifacts.find((artifact) => artifact.type === 'compare_result');
    return matchingArtifact?.id ?? null;
  }

  const matchingToolName = TOOL_RESULT_BY_EVIDENCE_TYPE[evidenceItem.type];
  if (matchingToolName) {
    const evidenceFileId = typeof evidenceItem.data.fileId === 'string' ? evidenceItem.data.fileId : null;
    const matchingFileArtifact = artifacts.find((artifact) =>
      artifact.type === 'tool_result'
      && artifact.toolName === matchingToolName
      && artifact.fileId === evidenceFileId);

    if (matchingFileArtifact) {
      return matchingFileArtifact.id;
    }

    const matchingArtifact = artifacts.find((artifact) =>
      artifact.type === 'tool_result' && artifact.toolName === matchingToolName);
    return matchingArtifact?.id ?? null;
  }

  return null;
}
