import type { RootState } from '../../../store/reduxStore';
import type { GetStateResult } from '../types/agentToolTypes';
import { getStateSelector } from '../store/getStateSelector';

export function getStateTool(state: RootState): GetStateResult {
  return getStateSelector(state);
}

export function getStateToolAsJson(state: RootState): string {
  const result = getStateTool(state);
  return JSON.stringify(result, null, 2);
}
