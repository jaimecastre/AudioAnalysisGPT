export type InvestigationRecord = {
  id: string;
  question: string;
  timestamp: string;
  toolsRun: string[];
  confidence: 'high' | 'medium' | 'low' | string;
  answer: string;
  traceId: string;
  limitations?: string[];
  plannedTools?: string[];
};
