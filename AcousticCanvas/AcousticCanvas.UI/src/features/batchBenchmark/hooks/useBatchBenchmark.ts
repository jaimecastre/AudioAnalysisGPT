import { useCallback, useState } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { callBatchBenchmarkTool } from '../services/batchBenchmarkService';
import type { BatchBenchmarkRequest, BatchBenchmarkResult } from '../types/batchBenchmarkTypes';
import {
  benchmarkStarted,
  benchmarkCompleted,
  benchmarkFailed,
  benchmarkProgressUpdated,
} from '../store/batchBenchmarkSlice';
import type { BenchmarkProgress } from '../store/batchBenchmarkSlice';

interface IUseBatchBenchmarkReturn {
  runBenchmark: (request: BatchBenchmarkRequest) => Promise<void>;
  isLoading: boolean;
}

export function useBatchBenchmark(): IUseBatchBenchmarkReturn {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const runBenchmark = useCallback(
    async (request: BatchBenchmarkRequest): Promise<void> => {
      setIsLoading(true);
      dispatch(benchmarkStarted());

      try {
        const handleProgress = (progress: BenchmarkProgress): void => {
          dispatch(benchmarkProgressUpdated(progress));
        };

        const result: BatchBenchmarkResult = await callBatchBenchmarkTool(
          request,
          handleProgress,
        );

        dispatch(benchmarkCompleted(result));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Benchmark failed';
        dispatch(benchmarkFailed(errorMessage));
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch],
  );

  return {
    runBenchmark,
    isLoading,
  };
}
