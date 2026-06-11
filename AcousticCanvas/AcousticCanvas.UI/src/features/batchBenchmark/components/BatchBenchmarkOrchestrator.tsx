import type { JSX } from 'react';
import { useAppSelector } from '../../../store/reduxHooks';
import { benchmarkShowModalSelector, benchmarkIsPanelOpenSelector, benchmarkResultSelector, benchmarkStatusSelector, benchmarkErrorSelector } from '../store/batchBenchmarkSlice';
import { BatchBenchmarkPanel } from './BatchBenchmarkPanel';
import { BenchmarkFilePickerModal } from './BenchmarkFilePickerModal';

export const BatchBenchmarkOrchestrator = (): JSX.Element => {
  const showModal = useAppSelector(benchmarkShowModalSelector);
  const isPanelOpen = useAppSelector(benchmarkIsPanelOpenSelector);
  const result = useAppSelector(benchmarkResultSelector);
  const status = useAppSelector(benchmarkStatusSelector);
  const error = useAppSelector(benchmarkErrorSelector);

  return (
    <>
      {isPanelOpen && (
        <BatchBenchmarkPanel
          result={result}
          status={status}
          error={error}
          onRerun={() => {}}
          onClose={() => {}}
        />
      )}
      {showModal && (
        <BenchmarkFilePickerModal
          opened={showModal}
          onClose={() => {}}
          files={[]}
          initialSelectedIds={new Set()}
          onConfirm={() => {}}
          isLoading={status === 'loading'}
        />
      )}
    </>
  );
};
