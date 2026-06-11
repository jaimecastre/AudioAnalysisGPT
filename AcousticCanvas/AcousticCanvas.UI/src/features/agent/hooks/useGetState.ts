import { useAppSelector } from '../../../store/reduxHooks';
import type { GetStateResult } from '../types/agentToolTypes';
import { getStateSelector } from '../store/getStateSelector';

export const useGetState = (): GetStateResult => {
  return useAppSelector(getStateSelector);
};
