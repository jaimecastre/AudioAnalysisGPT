import type { JSX } from 'react';
import { useAppSelector } from '../../../store/reduxHooks';
import { findingsShowPanelSelector } from '../store/findingsSlice';
import { selectedSignalIdSelector } from '../../project/store/projectSlice';
import { FindingsPanel } from './FindingsPanel';

export const FindingsOrchestrator = (): JSX.Element => {
  const showPanel = useAppSelector(findingsShowPanelSelector);
  const selectedFileId = useAppSelector(selectedSignalIdSelector);

  if (!showPanel || !selectedFileId) {
    return null;
  }

  return <FindingsPanel fileId={selectedFileId} onClose={() => {}} />;
};
