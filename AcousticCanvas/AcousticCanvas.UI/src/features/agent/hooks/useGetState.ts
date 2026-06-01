import { useAppSelector } from '../../../store/reduxHooks';
import type { GetStateResult } from '../agentToolTypes';
import { getStateSelector } from '../getStateSelector';

export const useGetState = (): GetStateResult => {
  return useAppSelector(getStateSelector);
};
