import { useState } from 'react';
import type { AnalyzeInput, AgentAnalysisResult } from '../types/agentToolTypes';
import { callAnalyzeTool } from '../services/analyzeToolService';

interface IUseAnalyzeToolReturn {
  isRunning: boolean;
  lastResult: AgentAnalysisResult | null;
  lastError: string | null;
  runAnalyze: (input: AnalyzeInput) => Promise<AgentAnalysisResult | null>;
}

export const useAnalyzeTool = (): IUseAnalyzeToolReturn => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<AgentAnalysisResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const runAnalyze = async (input: AnalyzeInput): Promise<AgentAnalysisResult | null> => {
    setIsRunning(true);
    setLastError(null);

    try {
      const result = await callAnalyzeTool(input);
      setLastResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      setLastError(errorMessage);
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  return {
    isRunning,
    lastResult,
    lastError,
    runAnalyze,
  };
};
