import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/reduxHooks';
import type { RootState } from '../../../store/reduxStore';
import {
  analysisResultRequested,
  analysisResultLoaded,
  analysisResultFailed,
  type AnalysisResult,
} from '../store/analysisResultsSlice';
import type { SpectrumPointsResponse } from '../types/spectrumTypes';
import type { SoundQualityAnalysis } from '../types/soundQualityTypes';
import type { CpbAnalysis } from '../types/cpbTypes';
import type { FindingsResult } from '../../findings/types/findingsTypes';

interface IUseAnalysisResultReturn {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  fetchResult: (resultId: string) => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5146';

export const useAnalysisResult = (resultId: string | null): IUseAnalysisResultReturn => {
  const dispatch = useAppDispatch();
  const abortControllerRef = useRef<AbortController | null>(null);

  const result = useAppSelector((state: RootState) =>
    resultId ? state.analysisResults?.resultsById?.[resultId] ?? null : null
  );
  const isLoading = useAppSelector((state: RootState) =>
    resultId ? state.analysisResults?.loadingIds?.[resultId] ?? false : false
  );
  const error = useAppSelector((state: RootState) =>
    resultId ? state.analysisResults?.errorById?.[resultId] ?? null : null
  );

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const fetchResult = useCallback(async (id: string): Promise<void> => {
    if (!id) return;
    const isValidResultId = /^[a-z]+_[0-9a-f]{32}$/.test(id);
    if (!isValidResultId) {
      dispatch(analysisResultFailed({ resultId: id, error: `Invalid result ID format: "${id}". The agent may have generated an incorrect ID.` }));
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch(analysisResultRequested(id));

    try {
      const response = await fetch(`${API_BASE_URL}/api/analysis/results/${id}`, {
        method: 'GET',
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analysis result: ${response.statusText}`);
      }

      const data = await response.json() as { type: string; data: unknown };
      const typedResult: AnalysisResult =
        data.type === 'spectrum'
          ? { type: 'spectrum', data: data.data as SpectrumPointsResponse }
          : data.type === 'soundQuality'
            ? { type: 'soundQuality', data: data.data as SoundQualityAnalysis }
            : data.type === 'cpb'
              ? { type: 'cpb', data: data.data as CpbAnalysis }
              : { type: 'findings', data: data.data as FindingsResult };
      dispatch(analysisResultLoaded({ resultId: id, result: typedResult }));
    } catch (err) {
      if (abortController.signal.aborted) return;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      dispatch(analysisResultFailed({ resultId: id, error: errorMessage }));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!resultId) return;
    const isValidResultId = /^[a-z]+_[0-9a-f]{32}$/.test(resultId);
    if (!isValidResultId || result || isLoading || error) return;
    fetchResult(resultId);
  }, [resultId, result, isLoading, error, fetchResult]);

  return { result, isLoading, error, fetchResult };
};
