import type { AppDispatch, RootState } from '../../../store/reduxStore';
import type { OpenAiToolCall } from './openAiClient';
import { getStateTool } from '../../agent/utils/getStateTool';
import { callAnalyzeTool } from '../../agent/services/analyzeToolService';
import { callCompareTool } from '../../agent/services/compareToolService';
import { callFindTool } from '../../agent/services/findToolService';
import { applyWorkspaceAction } from '../../agent/utils/workspaceTool';
import type { AnalysisKind, SpectralFocus, WorkspaceAction } from '../../agent/agentToolTypes';
import { SUPPORTED_ANALYSIS_KINDS, SUPPORTED_EVENT_KINDS } from '../../agent/capabilitiesRegistry';
import { analysisArtifactAdded, markerArtifactAdded, selectionArtifactAdded, compareArtifactAdded, findArtifactAdded, reportArtifactAdded } from '../agentWorkspaceSlice';
import type { AgentArtifact } from '../agentWorkspaceSlice';

export type ArtifactReference = {
  artifactType: AgentArtifact['type'];
  artifactId: string;
};

export type ToolExecutionResult = {
  toolCallId: string;
  toolName: string;
  resultJson: string;
  artifactRefs: ArtifactReference[];
};

function suggestClosestKind(requested: string, supported: string[]): string | null {
  const lowerRequested = requested.toLowerCase();
  const directContains = supported.find((candidate) => candidate.includes(lowerRequested) || lowerRequested.includes(candidate));
  if (directContains) return directContains;

  const requestedTokens = lowerRequested.split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  if (requestedTokens.length === 0) return supported[0] ?? null;

  const scored = supported
    .map((candidate) => {
      const score = requestedTokens.reduce((sum, token) => sum + (candidate.includes(token) ? 1 : 0), 0);
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0] && scored[0].score > 0 ? scored[0].candidate : (supported[0] ?? null);
}

function normalizeAnalysisKindAlias(kind: string): string {
  const normalized = kind.trim().toLowerCase();

  if (normalized === 'info' || normalized === 'metadata' || normalized === 'format' || normalized === 'file_metadata') {
    return 'file_info';
  }

  if (normalized === 'loudness' || normalized === 'volume' || normalized === 'gain' || normalized === 'amplitude') {
    return 'loudness';
  }

  if (normalized === 'peak' || normalized === 'peaks' || normalized === 'true_peak' || normalized === 'true-peak') {
    return 'peaks';
  }

  if (normalized === 'dynamic_range' || normalized === 'dynamic-range' || normalized === 'crest_factor' || normalized === 'crest-factor') {
    return 'dynamics';
  }

  if (normalized === 'fft' || normalized === 'frequency' || normalized === 'spectral' || normalized === 'frequency_content' || normalized === 'spectral_balance') {
    return 'spectral_balance';
  }

  if (normalized === 'phase' || normalized === 'stereo' || normalized === 'stereo image' || normalized === 'stereo_image') {
    return 'stereo_phase';
  }

  return normalized;
}

function mapAnalyzeKindToBackend(kind: string): AnalysisKind | null {
  if (kind === 'file_info' || kind === 'level' || kind === 'spectrum') {
    return kind;
  }

  if (kind === 'loudness' || kind === 'peaks' || kind === 'dynamics' || kind === 'stereo_phase' || kind === 'distortion') {
    return 'level';
  }

  if (kind === 'spectral_balance' || kind === 'noise' || kind === 'dialogue_clarity') {
    return 'spectrum';
  }

  return null;
}

function normalizeSpectralFocusAlias(focusRaw: string | null): SpectralFocus | null {
  if (!focusRaw) return null;

  const normalized = focusRaw.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'muddiness' || normalized === 'muddy') return 'muddy';
  if (normalized === 'boominess' || normalized === 'boomy') return 'boomy';
  if (normalized === 'boxiness' || normalized === 'boxy') return 'boxy';
  if (normalized === 'harshness' || normalized === 'harsh' || normalized === 'piercing') return 'harsh';
  if (normalized === 'sibilance' || normalized === 'sibilant') return 'sibilant';
  if (normalized === 'thinness' || normalized === 'thin') return 'thin';
  if (normalized === 'dullness' || normalized === 'dull') return 'dull';

  return 'general';
}

function normalizeEventKindAlias(kind: string): string {
  const normalized = kind.trim().toLowerCase();
  if (normalized === 'click' || normalized === 'clicks' || normalized === 'click_candidate' || normalized === 'click-candidate') {
    return 'transient';
  }
  if (normalized === 'loudest_region' || normalized === 'loudest-region') {
    return 'loudest';
  }
  return normalized;
}

function isClickAlias(kind: string): boolean {
  const normalized = kind.trim().toLowerCase();
  return normalized === 'click' || normalized === 'clicks' || normalized === 'click_candidate' || normalized === 'click-candidate';
}

function buildAlternativeSuggestions(requested: string, supported: string[]): string {
  const closest = suggestClosestKind(requested, supported);
  const ordered = [
    ...(closest ? [closest] : []),
    ...supported.filter((kind) => kind !== closest),
  ].slice(0, 2);

  if (ordered.length === 0) {
    return '';
  }

  return ` Closest available options: ${ordered.join(' or ')}.`;
}

function stripPathToFileName(value: string): string {
  const lastSlash = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
  return lastSlash >= 0 ? value.slice(lastSlash + 1) : value;
}

function sanitizeResultForLlm(json: string): string {
  try {
    const parsed = JSON.parse(json) as unknown;
    const sanitized = sanitizeValue(parsed);
    return JSON.stringify(sanitized);
  } catch {
    return json;
  }
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const isPathField = k === 'fileId' || k === 'fileIdA' || k === 'fileIdB';
      if (isPathField && typeof v === 'string') {
        result[k] = stripPathToFileName(v);
      } else {
        result[k] = sanitizeValue(v);
      }
    }
    return result;
  }
  return value;
}

function executeGetState(state: RootState): string {
  const result = getStateTool(state);
  const safeResult = {
    projectName: result.projectName,
    projectStatus: result.projectStatus,
    loadedFiles: result.loadedFiles,
    activeFile: result.activeFile,
    activeSelection: result.activeSelection,
    visibleViews: result.visibleViews,
    availableTools: result.capabilities.tools.map((tool) => tool.tool),
    availableAnalysisKinds: result.capabilities.analysisKinds.map((entry) => entry.kind),
  };
  return JSON.stringify(safeResult);
}

async function executeAnalyze(
  dispatch: AppDispatch,
  parsedArgs: Record<string, unknown>,
  state: RootState,
): Promise<{ resultJson: string; artifactRef: ArtifactReference | null }> {
  const kindRaw = String(parsedArgs['kind'] ?? '');
  const semanticKind = normalizeAnalysisKindAlias(kindRaw);
  const backendKind = mapAnalyzeKindToBackend(semanticKind);
  const focusRaw = typeof parsedArgs['focus'] === 'string' ? parsedArgs['focus'] : null;
  const normalizedFocus = normalizeSpectralFocusAlias(focusRaw);
  const fileId = parsedArgs['fileId'] as string;

  const activeSelection = state.waveformSelection.activeSelection;
  const selectionIsValid = activeSelection !== null
    && activeSelection.endSeconds > activeSelection.startSeconds;

  const argsStartSeconds = typeof parsedArgs['startSeconds'] === 'number' ? parsedArgs['startSeconds'] : null;
  const argsEndSeconds = typeof parsedArgs['endSeconds'] === 'number' ? parsedArgs['endSeconds'] : null;

  const startSeconds = argsStartSeconds ?? (selectionIsValid ? activeSelection!.startSeconds : null);
  const endSeconds = argsEndSeconds ?? (selectionIsValid ? activeSelection!.endSeconds : null);

  if (!backendKind) {
    const requested = String(parsedArgs['kind'] ?? '');
    const suggestion = buildAlternativeSuggestions(requested, SUPPORTED_ANALYSIS_KINDS);
    return {
      resultJson: JSON.stringify({
        error: `Analysis kind "${requested}" is not supported. Supported kinds: ${SUPPORTED_ANALYSIS_KINDS.join(', ')}.${suggestion}`,
      }),
      artifactRef: null,
    };
  }

  if (!fileId) {
    return {
      resultJson: JSON.stringify({ error: 'fileId is required for analyze().' }),
      artifactRef: null,
    };
  }

  const result = await callAnalyzeTool({
    kind: backendKind,
    fileId,
    startSeconds,
    endSeconds,
    focus: backendKind === 'spectrum' ? normalizedFocus : null,
  });

  const normalizedKindForCompare = kindRaw.trim().toLowerCase();
  const responseResult = {
    ...result,
    parameters: {
      ...(result.parameters ?? {}),
      requestedKind: kindRaw,
      semanticKind,
      resolvedBackendKind: backendKind,
      ...(backendKind === 'spectrum'
        ? {
            requestedFocus: focusRaw,
            resolvedFocus: normalizedFocus,
          }
        : {}),
      ...(normalizedKindForCompare !== semanticKind
        ? {
            aliasResolvedFrom: kindRaw,
            aliasResolvedTo: semanticKind,
          }
        : {}),
    },
  };
  const artifactId = crypto.randomUUID();

  dispatch(analysisArtifactAdded({
    type: 'analysis_result',
    id: artifactId,
    timestamp: new Date().toISOString(),
    result: responseResult,
  }));

  return {
    resultJson: JSON.stringify(responseResult),
    artifactRef: {
      artifactType: 'analysis_result',
      artifactId,
    },
  };
}

function executeWorkspace(
  dispatch: AppDispatch,
  parsedArgs: Record<string, unknown>,
): string {
  const action = parsedArgs['action'] as string;

  const workspaceAction = parsedArgs as unknown as WorkspaceAction;
  const workspaceResult = applyWorkspaceAction(dispatch, workspaceAction);

  if (workspaceResult.success) {
    if (action === 'add_marker') {
      dispatch(markerArtifactAdded({
        type: 'marker_added',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        fileId: parsedArgs['fileId'] as string,
        timeSeconds: parsedArgs['timeSeconds'] as number,
        label: parsedArgs['label'] as string,
      }));
    }

    if (action === 'set_selection' || action === 'set_loop_region') {
      dispatch(selectionArtifactAdded({
        type: 'selection_set',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        startSeconds: parsedArgs['startSeconds'] as number,
        endSeconds: parsedArgs['endSeconds'] as number,
      }));
    }
  }

  return JSON.stringify(workspaceResult);
}

function buildReportMarkdown(title: string, artifacts: AgentArtifact[], generatedAt: string): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push(`*Generated: ${generatedAt}*`);
  lines.push('');

  const analysisArtifacts = artifacts.filter((a) => a.type === 'analysis_result');
  const compareArtifacts = artifacts.filter((a) => a.type === 'compare_result');
  const findArtifacts = artifacts.filter((a) => a.type === 'find_result');
  const markerArtifacts = artifacts.filter((a) => a.type === 'marker_added');

  if (analysisArtifacts.length > 0) {
    lines.push('## Analysis Results');
    lines.push('');
    for (const artifact of analysisArtifacts) {
      if (artifact.type !== 'analysis_result') continue;
      const result = artifact.result;
      const regionText = result.regionStart !== null && result.regionEnd !== null
        ? ` (${result.regionStart.toFixed(3)}s – ${result.regionEnd.toFixed(3)}s)`
        : ' (full file)';
      lines.push(`### ${result.kind}${regionText}`);
      lines.push('');
      for (const [key, value] of Object.entries(result.summary)) {
        if (value === null || value === undefined) continue;
        const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        const formattedValue = typeof value === 'number'
          ? (Number.isInteger(value) ? String(value) : (value as number).toFixed(4))
          : String(value);
        lines.push(`- **${formattedKey}:** ${formattedValue}`);
      }
      lines.push('');
    }
  }

  if (compareArtifacts.length > 0) {
    lines.push('## Comparisons');
    lines.push('');
    for (const artifact of compareArtifacts) {
      if (artifact.type !== 'compare_result') continue;
      const result = artifact.result;
      lines.push('### File Comparison');
      lines.push('');
      for (const file of result.files) {
        const fileName = stripPathToFileName(file.fileId);
        lines.push(`**${fileName}** — peak: ${file.peakDb.toFixed(2)} dBFS · RMS: ${file.rmsDb.toFixed(2)} dBFS · crest: ${file.crestFactorDb.toFixed(2)} dB · peak freq: ${file.peakFrequencyHz.toFixed(0)} Hz`);
      }
      lines.push('');
      for (const diff of result.pairwiseDiffs) {
        const nameA = stripPathToFileName(diff.fileIdA);
        const nameB = stripPathToFileName(diff.fileIdB);
        lines.push(`**${nameA} vs ${nameB}** — peak Δ: ${diff.peakDeltaDb.toFixed(2)} dB · RMS Δ: ${diff.rmsDeltaDb.toFixed(2)} dB`);
        const strongestCpbDelta = diff.cpbBandDeltas
          ?.filter((band) => band.levelDb !== null && Number.isFinite(band.levelDb))
          .sort((a, b) => Math.abs(b.levelDb ?? 0) - Math.abs(a.levelDb ?? 0))[0];
        if (strongestCpbDelta?.levelDb !== null && strongestCpbDelta?.levelDb !== undefined) {
          const weightingLabel = strongestCpbDelta.weighting?.toUpperCase() ?? 'Z';
          lines.push(`Strongest CPB difference: ${strongestCpbDelta.label} Hz (${strongestCpbDelta.levelDb > 0 ? '+' : ''}${strongestCpbDelta.levelDb.toFixed(1)} dB, B − A, ${weightingLabel}-weighted).`);
        }
      }
      lines.push('');
    }
  }

  if (findArtifacts.length > 0) {
    lines.push('## Detected Events');
    lines.push('');
    for (const artifact of findArtifacts) {
      if (artifact.type !== 'find_result') continue;
      const result = artifact.result;
      const fileName = stripPathToFileName(result.fileId);
      lines.push(`### ${result.kind} — ${fileName}`);
      lines.push(`*${result.eventCount} event(s) found*`);
      lines.push('');
      for (const event of result.events) {
        lines.push(`- **${event.startSeconds.toFixed(3)}s – ${event.endSeconds.toFixed(3)}s** (${event.durationSeconds.toFixed(3)}s): ${event.description}`);
      }
      lines.push('');
    }
  }

  if (markerArtifacts.length > 0) {
    lines.push('## Markers');
    lines.push('');
    for (const artifact of markerArtifacts) {
      if (artifact.type !== 'marker_added') continue;
      lines.push(`- **${artifact.label}** at ${artifact.timeSeconds.toFixed(3)}s`);
    }
    lines.push('');
  }

  if (analysisArtifacts.length === 0 && compareArtifacts.length === 0 && findArtifacts.length === 0 && markerArtifacts.length === 0) {
    lines.push('*No analysis results found in this session. Run some analyses first.*');
  }

  return lines.join('\n');
}

function executeReport(
  dispatch: AppDispatch,
  parsedArgs: Record<string, unknown>,
  state: RootState,
): { resultJson: string; artifactRef: ArtifactReference } {
  const artifacts = state.agentWorkspace.artifacts;
  const customTitle = typeof parsedArgs['title'] === 'string' ? parsedArgs['title'] : null;
  const generatedAt = new Date().toLocaleString();
  const title = customTitle ?? `AcousticCanvas Session Report — ${generatedAt}`;

  const markdownContent = buildReportMarkdown(title, artifacts, generatedAt);

  const artifactId = crypto.randomUUID();
  dispatch(reportArtifactAdded({
    type: 'report',
    id: artifactId,
    timestamp: new Date().toISOString(),
    title,
    markdownContent,
  }));

  return {
    resultJson: JSON.stringify({ success: true, title, characterCount: markdownContent.length }),
    artifactRef: {
      artifactType: 'report',
      artifactId,
    },
  };
}

type ParseSuccess = { success: true; value: Record<string, unknown> };
type ParseFailure = { success: false };
type ParseJsonResult = ParseSuccess | ParseFailure;

function tryParseJson(raw: string): ParseJsonResult {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return { success: true, value };
  } catch {
    return { success: false };
  }
}

export async function executeToolCall(
  toolCall: OpenAiToolCall,
  dispatch: AppDispatch,
  state: RootState,
): Promise<ToolExecutionResult> {
  const toolName = toolCall.function.name;

  const parseResult = tryParseJson(toolCall.function.arguments);
  if (!parseResult.success) {
    return {
      toolCallId: toolCall.id,
      toolName,
      resultJson: JSON.stringify({ error: 'Failed to parse tool arguments.' }),
      artifactRefs: [],
    };
  }
  const parsedArgs = parseResult.value;

  let resultJson: string;
  const artifactRefs: ArtifactReference[] = [];

  if (toolName === 'getState') {
    resultJson = executeGetState(state);
  } else if (toolName === 'analyze') {
    try {
      const analyzeResult = await executeAnalyze(dispatch, parsedArgs, state);
      resultJson = analyzeResult.resultJson;
      if (analyzeResult.artifactRef) {
        artifactRefs.push(analyzeResult.artifactRef);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      resultJson = JSON.stringify({ error: errorMessage });
    }
  } else if (toolName === 'compare') {
    try {
      const fileIds = Array.isArray(parsedArgs['fileIds']) ? parsedArgs['fileIds'] as string[] : [];
      const startSeconds = typeof parsedArgs['startSeconds'] === 'number' ? parsedArgs['startSeconds'] : null;
      const endSeconds = typeof parsedArgs['endSeconds'] === 'number' ? parsedArgs['endSeconds'] : null;
      const compareResult = await callCompareTool({ fileIds, startSeconds, endSeconds });
      const artifactId = crypto.randomUUID();
      dispatch(compareArtifactAdded({
        type: 'compare_result',
        id: artifactId,
        timestamp: new Date().toISOString(),
        result: compareResult,
      }));
      artifactRefs.push({
        artifactType: 'compare_result',
        artifactId,
      });
      resultJson = JSON.stringify(compareResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compare failed';
      resultJson = JSON.stringify({ error: errorMessage });
    }
  } else if (toolName === 'find') {
    try {
      const fileId = typeof parsedArgs['fileId'] === 'string' ? parsedArgs['fileId'] : '';
      const kindRaw = typeof parsedArgs['kind'] === 'string' ? parsedArgs['kind'] : 'clipping';
      const normalizedKind = normalizeEventKindAlias(kindRaw);
      if (!SUPPORTED_EVENT_KINDS.includes(normalizedKind)) {
        const suggestion = buildAlternativeSuggestions(normalizedKind, SUPPORTED_EVENT_KINDS);
        resultJson = JSON.stringify({
          error: `Event kind "${kindRaw}" is not supported. Supported kinds: ${SUPPORTED_EVENT_KINDS.join(', ')}.${suggestion}`,
        });
      } else {
        const kind = normalizedKind as 'clipping' | 'silence' | 'loudest' | 'transient';
        const startSeconds = typeof parsedArgs['startSeconds'] === 'number' ? parsedArgs['startSeconds'] : null;
        const endSeconds = typeof parsedArgs['endSeconds'] === 'number' ? parsedArgs['endSeconds'] : null;
        const findResult = await callFindTool({ fileId, kind, startSeconds, endSeconds });

        const usedClickAlias = kind === 'transient' && isClickAlias(kindRaw);
        const responseResult = usedClickAlias
          ? {
              ...findResult,
              kind: 'click_candidate',
              events: findResult.events.map((event) => ({
                ...event,
                description: event.description.replace('Transient onset', 'Click candidate'),
              })),
              detectorKind: 'transient',
            }
          : findResult;

        const artifactId = crypto.randomUUID();
        dispatch(findArtifactAdded({
          type: 'find_result',
          id: artifactId,
          timestamp: new Date().toISOString(),
          result: responseResult,
        }));
        artifactRefs.push({
          artifactType: 'find_result',
          artifactId,
        });
        resultJson = JSON.stringify(responseResult);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Find failed';
      resultJson = JSON.stringify({ error: errorMessage });
    }
  } else if (toolName === 'workspace') {
    resultJson = executeWorkspace(dispatch, parsedArgs);
  } else if (toolName === 'report') {
    const reportResult = executeReport(dispatch, parsedArgs, state);
    resultJson = reportResult.resultJson;
    artifactRefs.push(reportResult.artifactRef);
  } else {
    resultJson = JSON.stringify({ error: `Unknown tool: ${toolName}. Available tools: getState, analyze, compare, find, workspace, report.` });
  }

  return {
    toolCallId: toolCall.id,
    toolName,
    resultJson: sanitizeResultForLlm(resultJson),
    artifactRefs,
  };
}
