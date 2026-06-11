import type { JSX } from 'react';
import { useAppSelector } from '../../../store/reduxHooks';
import { analysisShowInspectorSelector, analysisResultSelector, analysisStatusSelector, analysisErrorSelector } from '../store/analysisSlice';
import { AnalysisInspector } from './AnalysisInspector';

export const AnalysisOrchestrator = (): JSX.Element => {
  const showInspector = useAppSelector(analysisShowInspectorSelector);
  const result = useAppSelector(analysisResultSelector);
  const status = useAppSelector(analysisStatusSelector);
  const error = useAppSelector(analysisErrorSelector);

  if (!showInspector) {
    return null;
  }

  return <AnalysisInspector result={result} status={status} error={error} />;
};
