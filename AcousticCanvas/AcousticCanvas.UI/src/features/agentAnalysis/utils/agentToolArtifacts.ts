import type { ToolResultRow } from '../store/agentWorkspaceSlice';
import { extractAgentToolRows } from './agentToolRows';

export type ToolResultArtifactDraft = {
  toolName: string;
  fileId?: string;
  rows: ToolResultRow[];
};

function getResults(raw: unknown): Array<Record<string, unknown>> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const results = data['results'];
  if (!Array.isArray(results)) return null;
  return results.filter((result): result is Record<string, unknown> =>
    typeof result === 'object' && result !== null);
}

function getFileId(result: Record<string, unknown>): string | undefined {
  return typeof result['fileId'] === 'string' ? result['fileId'] : undefined;
}

export function createToolResultArtifactDrafts(
  toolName: string,
  raw: unknown,
): ToolResultArtifactDraft[] {
  if (
    toolName === 'run_spectrogram'
    || toolName === 'run_spectrum'
    || toolName === 'run_cpb'
    || toolName === 'run_sound_quality_metrics'
  ) {
    const results = getResults(raw);
    if (!results?.length) return [];

    const drafts: ToolResultArtifactDraft[] = [];
    for (const result of results) {
      const rows = extractAgentToolRows(toolName, { results: [result] });
      if (rows === null) continue;
      drafts.push({
        toolName,
        fileId: getFileId(result),
        rows,
      });
    }
    return drafts;
  }

  const rows = extractAgentToolRows(toolName, raw);
  if (rows === null) return [];
  return [{ toolName, rows }];
}
