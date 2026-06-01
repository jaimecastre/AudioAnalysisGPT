import type { AppDispatch, RootState } from '../../../store/reduxStore';
import type { OpenAiToolCall } from './openAiClient';
import { getStateTool } from '../../agent/utils/getStateTool';
import { callAnalyzeTool } from '../../agent/services/analyzeToolService';
import { applyWorkspaceAction } from '../../agent/utils/workspaceTool';
import type { AnalysisKind, WorkspaceAction } from '../../agent/agentToolTypes';
import { analysisArtifactAdded, markerArtifactAdded, selectionArtifactAdded } from '../agentWorkspaceSlice';

export type ToolExecutionResult = {
  toolCallId: string;
  toolName: string;
  resultJson: string;
};

function executeGetState(state: RootState): string {
  const result = getStateTool(state);
  const safeResult = {
    projectName: result.projectName,
    projectStatus: result.projectStatus,
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
): Promise<string> {
  const kind = parsedArgs['kind'] as AnalysisKind;
  const fileId = parsedArgs['fileId'] as string;
  const startSeconds = typeof parsedArgs['startSeconds'] === 'number' ? parsedArgs['startSeconds'] : null;
  const endSeconds = typeof parsedArgs['endSeconds'] === 'number' ? parsedArgs['endSeconds'] : null;

  const validKinds: AnalysisKind[] = ['file_info', 'level', 'spectrum'];
  const isValidKind = validKinds.includes(kind);
  if (!isValidKind) {
    return JSON.stringify({ error: `Unknown analysis kind: ${kind}. Supported: file_info, level, spectrum.` });
  }

  if (!fileId) {
    return JSON.stringify({ error: 'fileId is required for analyze().' });
  }

  const result = await callAnalyzeTool({ kind, fileId, startSeconds, endSeconds });

  dispatch(analysisArtifactAdded({
    type: 'analysis_result',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    result,
  }));

  return JSON.stringify(result);
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
    };
  }
  const parsedArgs = parseResult.value;

  let resultJson: string;

  if (toolName === 'getState') {
    resultJson = executeGetState(state);
  } else if (toolName === 'analyze') {
    try {
      resultJson = await executeAnalyze(dispatch, parsedArgs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      resultJson = JSON.stringify({ error: errorMessage });
    }
  } else if (toolName === 'workspace') {
    resultJson = executeWorkspace(dispatch, parsedArgs);
  } else {
    resultJson = JSON.stringify({ error: `Unknown tool: ${toolName}. Available tools: getState, analyze, workspace.` });
  }

  return {
    toolCallId: toolCall.id,
    toolName,
    resultJson,
  };
}
