import type { AppDispatch, RootState } from '../../store/reduxStore';
import { runLlmToolLoop } from './llm/llmToolLoop';
import { getStateTool } from '../agent/utils/getStateTool';
import { callAnalyzeTool } from '../agent/services/analyzeToolService';
import { applyWorkspaceAction } from '../agent/utils/workspaceTool';
import type { AgentAnalysisResult, WorkspaceAction } from '../agent/agentToolTypes';
import {
  toolCallStarted,
  toolCallFinished,
  assistantMessageReceived,
} from './chatSlice';
import {
  analysisArtifactAdded,
  markerArtifactAdded,
  selectionArtifactAdded,
} from './agentWorkspaceSlice';

export type ToolRunnerIntent =
  | 'get_state'
  | 'analyze_level'
  | 'analyze_file_info'
  | 'analyze_spectrum'
  | 'add_marker'
  | 'set_selection'
  | 'unknown';

function classifyIntent(userText: string): ToolRunnerIntent {
  const lowered = userText.toLowerCase();

  if (lowered.includes('spectrum') || lowered.includes('fft') || lowered.includes('frequency')) {
    return 'analyze_spectrum';
  }
  if (lowered.includes('peak') || lowered.includes('level') || lowered.includes('rms') || lowered.includes('loudness')) {
    return 'analyze_level';
  }
  if (lowered.includes('file') || lowered.includes('format') || lowered.includes('sample rate') || lowered.includes('duration') || lowered.includes('what is loaded') || lowered.includes('info')) {
    return 'analyze_file_info';
  }
  if (lowered.includes('mark') || lowered.includes('add marker') || lowered.includes('pin')) {
    return 'add_marker';
  }
  if (lowered.includes('select') || lowered.includes('region') || lowered.includes('loop')) {
    return 'set_selection';
  }
  if (lowered.includes('state') || lowered.includes('workspace') || lowered.includes('what') || lowered.includes('show')) {
    return 'get_state';
  }
  return 'unknown';
}

function buildGetStateResponse(state: RootState): string {
  const workspace = getStateTool(state);
  if (!workspace.activeFile) {
    return 'No audio file is currently loaded. Import a file to get started.';
  }
  const file = workspace.activeFile;
  const selection = workspace.activeSelection;
  const selectionText = selection
    ? `\nActive selection: ${selection.startSeconds.toFixed(3)}s – ${selection.endSeconds.toFixed(3)}s (${selection.durationSeconds.toFixed(3)}s)`
    : '\nNo active selection.';
  return `**Workspace state:**\n- File: ${file.name}\n- Duration: ${file.durationSeconds.toFixed(3)}s\n- Sample rate: ${file.sampleRate} Hz\n- Channels: ${file.channels}\n- Bit depth: ${file.bitDepth}-bit${selectionText}`;
}

function buildAnalysisResponse(result: AgentAnalysisResult): string {
  const summaryLines = Object.entries(result.summary)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      const formattedValue = typeof value === 'number' ? (Number.isInteger(value) ? String(value) : (value as number).toFixed(4)) : String(value);
      return `- ${formattedKey}: ${formattedValue}`;
    });

  const kindLabel = result.kind === 'file_info' ? 'File Info' : result.kind === 'level' ? 'Level Analysis' : 'Spectrum Analysis';
  const regionText = result.regionStart !== null && result.regionEnd !== null
    ? ` (region ${result.regionStart.toFixed(3)}s – ${result.regionEnd.toFixed(3)}s)`
    : ' (full file)';

  return `**${kindLabel}${regionText}:**\n${summaryLines.join('\n')}`;
}

function buildMarkerResponse(label: string, timeSeconds: number): string {
  return `Marker **"${label}"** added at ${timeSeconds.toFixed(3)}s.`;
}

function buildSelectionResponse(startSeconds: number, endSeconds: number): string {
  const duration = endSeconds - startSeconds;
  return `Selection set from **${startSeconds.toFixed(3)}s** to **${endSeconds.toFixed(3)}s** (${duration.toFixed(3)}s).`;
}

async function runGetState(
  dispatch: AppDispatch,
  state: RootState,
): Promise<string> {
  const toolCallId = crypto.randomUUID();

  dispatch(toolCallStarted({
    id: toolCallId,
    toolName: 'getState()',
    content: 'Calling getState()…',
    timestamp: new Date().toISOString(),
  }));

  const responseText = buildGetStateResponse(state);

  dispatch(toolCallFinished({
    id: toolCallId,
    toolStatus: 'done',
    content: 'getState() → workspace snapshot retrieved',
  }));

  return responseText;
}

async function runAnalyze(
  dispatch: AppDispatch,
  state: RootState,
  kind: 'file_info' | 'level' | 'spectrum',
): Promise<string> {
  const workspace = getStateTool(state);

  if (!workspace.activeFile) {
    return 'No file is loaded. Please import an audio file first.';
  }

  const toolCallId = crypto.randomUUID();
  const fileId = workspace.activeFile.id;
  const selection = workspace.activeSelection;
  const startSeconds = selection ? selection.startSeconds : null;
  const endSeconds = selection ? selection.endSeconds : null;

  dispatch(toolCallStarted({
    id: toolCallId,
    toolName: `analyze("${kind}")`,
    content: `Calling analyze("${kind}")…`,
    timestamp: new Date().toISOString(),
  }));

  try {
    const result = await callAnalyzeTool({ kind, fileId, startSeconds, endSeconds });

    dispatch(toolCallFinished({
      id: toolCallId,
      toolStatus: 'done',
      content: `analyze("${kind}") → result received`,
    }));

    dispatch(analysisArtifactAdded({
      type: 'analysis_result',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      result,
    }));

    return buildAnalysisResponse(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    dispatch(toolCallFinished({
      id: toolCallId,
      toolStatus: 'error',
      content: `analyze("${kind}") → error: ${errorMessage}`,
    }));

    return `Analysis failed: ${errorMessage}`;
  }
}

async function runAddMarker(
  dispatch: AppDispatch,
  state: RootState,
): Promise<string> {
  const workspace = getStateTool(state);

  if (!workspace.activeFile) {
    return 'No file is loaded. Please import an audio file first.';
  }

  const toolCallId = crypto.randomUUID();
  const timeSeconds = workspace.activeSelection?.startSeconds ?? 0;
  const label = 'Agent marker';
  const fileId = workspace.activeFile.id;

  dispatch(toolCallStarted({
    id: toolCallId,
    toolName: 'workspace("add_marker")',
    content: 'Calling workspace("add_marker")…',
    timestamp: new Date().toISOString(),
  }));

  const workspaceAction: WorkspaceAction = {
    action: 'add_marker',
    fileId,
    timeSeconds,
    label,
  };

  applyWorkspaceAction(dispatch, workspaceAction);

  dispatch(toolCallFinished({
    id: toolCallId,
    toolStatus: 'done',
    content: `workspace("add_marker") → marker added at ${timeSeconds.toFixed(3)}s`,
  }));

  dispatch(markerArtifactAdded({
    type: 'marker_added',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    fileId,
    timeSeconds,
    label,
  }));

  return buildMarkerResponse(label, timeSeconds);
}

async function runSetSelection(
  dispatch: AppDispatch,
  state: RootState,
): Promise<string> {
  const workspace = getStateTool(state);

  if (!workspace.activeFile) {
    return 'No file is loaded. Please import an audio file first.';
  }

  const toolCallId = crypto.randomUUID();
  const durationSeconds = workspace.activeFile.durationSeconds;
  const startSeconds = durationSeconds * 0.25;
  const endSeconds = durationSeconds * 0.75;

  dispatch(toolCallStarted({
    id: toolCallId,
    toolName: 'workspace("set_selection")',
    content: 'Calling workspace("set_selection")…',
    timestamp: new Date().toISOString(),
  }));

  const workspaceAction: WorkspaceAction = {
    action: 'set_selection',
    startSeconds,
    endSeconds,
  };

  applyWorkspaceAction(dispatch, workspaceAction);

  dispatch(toolCallFinished({
    id: toolCallId,
    toolStatus: 'done',
    content: `workspace("set_selection") → region set`,
  }));

  dispatch(selectionArtifactAdded({
    type: 'selection_set',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    startSeconds,
    endSeconds,
  }));

  return buildSelectionResponse(startSeconds, endSeconds);
}

export async function runAgentToolLoop(
  userText: string,
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<void> {
  const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const hasApiKey = typeof openAiApiKey === 'string' && openAiApiKey.trim().length > 0;

  if (hasApiKey) {
    await runLlmToolLoop(userText, dispatch, getState, openAiApiKey!);
    return;
  }

  const mockIndicatorId = crypto.randomUUID();
  dispatch(toolCallStarted({
    id: mockIndicatorId,
    toolName: 'mock-runner',
    content: 'No API key — running in mock mode',
    timestamp: new Date().toISOString(),
  }));
  dispatch(toolCallFinished({
    id: mockIndicatorId,
    toolStatus: 'error',
    content: 'No API key — running in mock mode. Add VITE_OPENAI_API_KEY to .env to enable real AI.',
  }));

  const intent = classifyIntent(userText);
  const currentState = getState();
  let responseText: string;

  if (intent === 'get_state') {
    responseText = await runGetState(dispatch, currentState);
  } else if (intent === 'analyze_level') {
    responseText = await runAnalyze(dispatch, currentState, 'level');
  } else if (intent === 'analyze_file_info') {
    responseText = await runAnalyze(dispatch, currentState, 'file_info');
  } else if (intent === 'analyze_spectrum') {
    responseText = await runAnalyze(dispatch, currentState, 'spectrum');
  } else if (intent === 'add_marker') {
    responseText = await runAddMarker(dispatch, currentState);
  } else if (intent === 'set_selection') {
    responseText = await runSetSelection(dispatch, currentState);
  } else {
    responseText = "I didn't recognise a specific command. Try asking about: file info, level/peak, spectrum, markers, or selection. (No API key configured — running in mock mode.)";
  }

  dispatch(assistantMessageReceived({
    id: crypto.randomUUID(),
    content: responseText,
    timestamp: new Date().toISOString(),
  }));
}
