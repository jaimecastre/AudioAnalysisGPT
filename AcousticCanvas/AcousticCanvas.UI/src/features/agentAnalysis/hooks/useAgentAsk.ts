import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store/reduxStore';
import {
  agentThinkingFinished,
  assistantMessageFailed,
  assistantMessageReceived,
  assistantResponseStarted,
} from '../chatSlice';
import type { AgentAskResponse } from '../services/agentAskService';
import { callAgentAskEndpoint } from '../services/agentAskService';
import {
  agentAskStarted,
  agentAskSucceeded,
  agentAskFailed,
  agentAskReset,
  agentAskStatusSelector,
  agentAskResponseSelector,
  agentAskErrorSelector,
} from '../agentAskSlice';
import { findingsArtifactAdded, toolResultArtifactAdded } from '../agentWorkspaceSlice';
import type { FindingItem, ToolResultRow } from '../agentWorkspaceSlice';

const TOOL_TITLES: Record<string, string> = {
  get_metadata: 'Metadata',
  run_basic_metrics: 'Level Metrics',
  run_event_detection: 'Event Detection',
  run_spectrum: 'Spectrum',
  run_cpb: 'CPB Analysis',
  run_sound_quality_metrics: 'Sound Quality',
};

function fmtDb(v: unknown): string {
  return typeof v === 'number' ? `${v.toFixed(2)} dBFS` : String(v);
}

function fmtHz(v: unknown): string {
  return typeof v === 'number' ? `${v.toFixed(0)} Hz` : String(v);
}

function fmtSq(value: unknown, unit: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(3)} ${unit ?? ''}`.trim() : String(value);
}

function extractToolRows(toolName: string, raw: unknown): ToolResultRow[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;

  if (toolName === 'get_metadata') {
    const results = d['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const f = results[0];
    const rows: ToolResultRow[] = [
      { label: 'file', value: String(f['fileName'] ?? '') },
      { label: 'duration', value: typeof f['durationSeconds'] === 'number' ? `${(f['durationSeconds'] as number).toFixed(2)}s` : '' },
      { label: 'sample rate', value: fmtHz(f['sampleRateHz']) },
      { label: 'channels', value: String(f['channels'] ?? '') },
      { label: 'bit depth', value: String(f['bitDepth'] ?? '') },
    ];
    if (results.length > 1) rows.push({ label: 'files', value: String(results.length) });
    return rows;
  }

  if (toolName === 'run_basic_metrics') {
    const results = d['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const r of results) {
      const m = r['metrics'] as Record<string, unknown> | undefined;
      if (!m) continue;
      const prefix = results.length > 1 ? `${String(r['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}RMS`, value: fmtDb(m['rmsDbFs']) });
      rows.push({ label: `${prefix}peak`, value: fmtDb(m['peakDbFs']) });
      rows.push({ label: `${prefix}crest factor`, value: fmtDb(m['crestFactorDb']) });
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_event_detection') {
    const kind = String(d['kind'] ?? '');
    const count = d['eventCount'];
    const events = d['events'] as Array<Record<string, unknown>> | undefined;
    const rows: ToolResultRow[] = [
      { label: 'kind', value: kind.replace(/_/g, ' ') },
      { label: 'events found', value: String(count ?? 0) },
    ];
    if (events) {
      for (const e of events.slice(0, 5)) {
        const t = typeof e['startSeconds'] === 'number' ? `${(e['startSeconds'] as number).toFixed(3)}s` : '';
        rows.push({ label: t, value: String(e['description'] ?? '') });
      }
    }
    return rows;
  }

  if (toolName === 'run_spectrum') {
    const results = d['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const r of results) {
      const s = r['summary'] as Record<string, unknown> | undefined;
      if (!s) continue;
      const prefix = results.length > 1 ? `${String(r['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}peak frequency`, value: fmtHz(s['peakFrequencyHz']) });
      rows.push({ label: `${prefix}max magnitude`, value: fmtDb(s['maxMagnitudeDb']) });
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_cpb') {
    const results = d['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const r of results) {
      const prefix = results.length > 1 ? `${String(r['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}band mode`, value: String(r['bandMode'] ?? '') });
      rows.push({ label: `${prefix}weighting`, value: String(r['weighting'] ?? 'Z') });
      const s = r['summary'] as Record<string, unknown> | undefined;
      const bands = s?.['highestBands'] as Array<Record<string, unknown>> | undefined;
      if (bands) {
        for (const b of bands.slice(0, 3)) {
          rows.push({ label: String(b['label'] ?? ''), value: fmtDb(b['levelDb']) });
        }
      }
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_sound_quality_metrics') {
    const results = d['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const r of results) {
      const prefix = results.length > 1 ? `${String(r['fileId']).slice(-4)} ` : '';
      const loudness = r['loudness'] as Record<string, unknown> | undefined;
      const sharpness = r['sharpness'] as Record<string, unknown> | undefined;
      const roughness = r['roughness'] as Record<string, unknown> | undefined;
      if (loudness) rows.push({ label: `${prefix}loudness`, value: fmtSq(loudness['value'], loudness['unit']) });
      if (sharpness) rows.push({ label: `${prefix}sharpness`, value: fmtSq(sharpness['value'], sharpness['unit']) });
      if (roughness) rows.push({ label: `${prefix}roughness`, value: fmtSq(roughness['value'], roughness['unit']) });
    }
    return rows.length ? rows : null;
  }

  return null;
}

export function useAgentAsk() {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector(agentAskStatusSelector);
  const response = useSelector(agentAskResponseSelector);
  const error = useSelector(agentAskErrorSelector);

  const abortControllerRef = useRef<AbortController | null>(null);

  function buildChatContent(
    agentResponse: AgentAskResponse,
    artifactTokens: string[],
  ): string {
    let content = agentResponse.answer;

    if (agentResponse.suggestedNextSteps.length > 0) {
      content += `\n\nNext steps: ${agentResponse.suggestedNextSteps.join(' ')}`;
    }

    if (artifactTokens.length > 0) {
      content += `\n\n${artifactTokens.join(' ')}`;
    }

    return content;
  }

  async function submitQuestion(question: string, selectedFileIds: string[]) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const assistantMessageId = crypto.randomUUID();

    dispatch(agentAskStarted());
    dispatch(assistantResponseStarted({
      id: assistantMessageId,
      timestamp: new Date().toISOString(),
    }));

    try {
      const agentResponse = await callAgentAskEndpoint(
        {
          question,
          selectedFileIds,
          mode: 'investigate',
        },
        abortController.signal,
      );

      dispatch(agentAskSucceeded(agentResponse));

      const artifactTokens: string[] = [];
      const toolData = agentResponse.toolResultsData;

      for (const exec of agentResponse.toolExecutions) {
        if (exec.status !== 'completed' || !exec.resultRef || !toolData) continue;
        const raw = toolData[exec.resultRef];
        if (!raw) continue;

        if (exec.toolName === 'run_findings') {
          const data = raw as { fileId: string; findingCount: number; ranAt: string; findings: FindingItem[] };
          const artifactId = crypto.randomUUID();
          dispatch(findingsArtifactAdded({
            type: 'findings_result',
            id: artifactId,
            timestamp: new Date().toISOString(),
            fileId: data.fileId,
            findingCount: data.findingCount,
            ranAt: data.ranAt,
            findings: data.findings,
          }));
          artifactTokens.push(`[findings_result:${artifactId}]`);
          continue;
        }

        const rows = extractToolRows(exec.toolName, raw);
        if (rows === null) continue;

        const artifactId = crypto.randomUUID();
        dispatch(toolResultArtifactAdded({
          type: 'tool_result',
          id: artifactId,
          timestamp: new Date().toISOString(),
          toolName: exec.toolName,
          title: TOOL_TITLES[exec.toolName] ?? exec.toolName,
          rows,
        }));
        artifactTokens.push(`[tool_result:${artifactId}]`);
      }

      dispatch(assistantMessageReceived({
        id: assistantMessageId,
        content: buildChatContent(agentResponse, artifactTokens),
        timestamp: new Date().toISOString(),
      }));
      dispatch(agentThinkingFinished());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error from agent.';
      dispatch(agentAskFailed(errorMessage));
      dispatch(assistantMessageFailed({
        id: assistantMessageId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  function resetAgentAsk() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    dispatch(agentAskReset());
  }

  const isAnalyzing = status === 'analyzing';

  return {
    status,
    response,
    error,
    isAnalyzing,
    submitQuestion,
    resetAgentAsk,
  };
}
