import { useAppDispatch } from '../../../store/reduxHooks';
import type { WorkspaceAction, WorkspaceResult } from '../types/agentToolTypes';
import { applyWorkspaceAction } from '../utils/workspaceTool';

interface UseWorkspaceToolReturn {
  applyAction: (workspaceAction: WorkspaceAction) => WorkspaceResult;
}

export const useWorkspaceTool = (): UseWorkspaceToolReturn => {
  const dispatch = useAppDispatch();

  const applyAction = (workspaceAction: WorkspaceAction): WorkspaceResult => {
    return applyWorkspaceAction(dispatch, workspaceAction);
  };

  return { applyAction };
};
