import type { AppDispatch } from '../../../store/reduxStore';
import type { WorkspaceAction, WorkspaceResult } from '../types/agentToolTypes';
import {
  setSelectedSignal,
  addMarker,
  openView,
  closeView,
} from '../../project/store/projectSlice';
import {
  setActiveSelection,
  setLoopEnabled,
} from '../../waveform/store/waveformSelectionSlice';

function applySetActiveFile(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'set_active_file' }>): WorkspaceResult {
  dispatch(setSelectedSignal(action.fileId));
  return {
    appliedAction: 'set_active_file',
    success: true,
    detail: `Active file set to ${action.fileId}`,
  };
}

function applySetSelection(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'set_selection' }>): WorkspaceResult {
  const selectionIsValid = action.endSeconds > action.startSeconds;
  if (!selectionIsValid) {
    return {
      appliedAction: 'set_selection',
      success: false,
      detail: `Invalid selection: endSeconds (${action.endSeconds}) must be greater than startSeconds (${action.startSeconds})`,
    };
  }

  dispatch(setActiveSelection({
    id: crypto.randomUUID(),
    startSeconds: action.startSeconds,
    endSeconds: action.endSeconds,
  }));

  return {
    appliedAction: 'set_selection',
    success: true,
    detail: `Selection set from ${action.startSeconds}s to ${action.endSeconds}s`,
  };
}

function applyOpenView(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'open_view' }>): WorkspaceResult {
  dispatch(openView(action.view));
  return {
    appliedAction: 'open_view',
    success: true,
    detail: `Opened view: ${action.view}`,
  };
}

function applyCloseView(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'close_view' }>): WorkspaceResult {
  dispatch(closeView(action.view));
  return {
    appliedAction: 'close_view',
    success: true,
    detail: `Closed view: ${action.view}`,
  };
}

function applyAddMarker(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'add_marker' }>): WorkspaceResult {
  const newMarkerId = crypto.randomUUID();
  dispatch(addMarker({
    id: newMarkerId,
    fileId: action.fileId,
    timeSeconds: action.timeSeconds,
    label: action.label,
    source: 'agent',
  }));
  return {
    appliedAction: 'add_marker',
    success: true,
    detail: `Marker "${action.label}" added at ${action.timeSeconds}s (id: ${newMarkerId})`,
  };
}

function applySetLoopRegion(dispatch: AppDispatch, action: Extract<WorkspaceAction, { action: 'set_loop_region' }>): WorkspaceResult {
  const selectionIsValid = action.endSeconds > action.startSeconds;
  if (!selectionIsValid) {
    return {
      appliedAction: 'set_loop_region',
      success: false,
      detail: `Invalid loop region: endSeconds (${action.endSeconds}) must be greater than startSeconds (${action.startSeconds})`,
    };
  }

  dispatch(setActiveSelection({
    id: crypto.randomUUID(),
    startSeconds: action.startSeconds,
    endSeconds: action.endSeconds,
  }));
  dispatch(setLoopEnabled(true));

  return {
    appliedAction: 'set_loop_region',
    success: true,
    detail: `Loop region set from ${action.startSeconds}s to ${action.endSeconds}s and loop enabled`,
  };
}

export function applyWorkspaceAction(dispatch: AppDispatch, workspaceAction: WorkspaceAction): WorkspaceResult {
  if (workspaceAction.action === 'set_active_file') {
    return applySetActiveFile(dispatch, workspaceAction);
  }

  if (workspaceAction.action === 'set_selection') {
    return applySetSelection(dispatch, workspaceAction);
  }

  if (workspaceAction.action === 'open_view') {
    return applyOpenView(dispatch, workspaceAction);
  }

  if (workspaceAction.action === 'close_view') {
    return applyCloseView(dispatch, workspaceAction);
  }

  if (workspaceAction.action === 'add_marker') {
    return applyAddMarker(dispatch, workspaceAction);
  }

  if (workspaceAction.action === 'set_loop_region') {
    return applySetLoopRegion(dispatch, workspaceAction);
  }

  const exhaustivenessCheck: never = workspaceAction;
  return {
    appliedAction: 'unknown',
    success: false,
    detail: `Unknown workspace action: ${JSON.stringify(exhaustivenessCheck)}`,
  };
}
