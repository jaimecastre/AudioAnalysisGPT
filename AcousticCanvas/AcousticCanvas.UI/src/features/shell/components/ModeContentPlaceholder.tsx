import type { JSX } from 'react';
import { ManualWorkspace } from '../../manualAnalysis/components/ManualWorkspace';
import { AgentWorkspace } from '../../agentAnalysis/components/AgentWorkspace';
import { useAppSelector } from '../../../store/reduxHooks';
import { activeModeSelector } from '../../navigation/store/navigationSlice';

export const ModeContentPlaceholder = (): JSX.Element => {
  const activeMode = useAppSelector(activeModeSelector);

  if (activeMode === 'manual') {
    return <ManualWorkspace />;
  }

  return <AgentWorkspace />;
};
