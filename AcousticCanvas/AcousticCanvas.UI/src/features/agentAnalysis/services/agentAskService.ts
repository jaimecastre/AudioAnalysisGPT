import { toFriendlyAgentError } from './agentErrorMessage';

const API_BASE_URL = 'http://localhost:5146';

export type AgentToolExecutionRecord = {
  toolName: string;
  status: 'completed' | 'failed';
  resultRef: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type StatisticRow = {
  label: string;
  value: string;
  unit?: string;
};

export type ChartMetadata = {
  sourceTool?: string;
  fileId?: string;
  fileName?: string;
  fftSize?: number;
  windowType?: string;
  overlapPercent?: number;
  scaling?: string;
  calibrationNote?: string;
  computedAtUtc?: string;
};

export type MarkdownBlock = {
  blockType: 'markdown';
  content: string;
};

export type StatisticsBlock = {
  blockType: 'statistics';
  title: string;
  rows: StatisticRow[];
};

export type SpectrumChartBlock = {
  blockType: 'spectrumChart';
  fileId: string;
  fileName: string;
  frequenciesHz: number[];
  magnitudesDb: number[];
  peakFrequencyHz?: number;
  metadata: ChartMetadata;
};

export type RankedItem = {
  rank: number;
  fileId: string;
  fileName: string;
  score: number;
  scoreLabel: string;
  scoreUnit?: string;
};

export type RankingBlock = {
  blockType: 'ranking';
  title: string;
  metricName: string;
  rankedItems: RankedItem[];
};

export type SuggestedAction = {
  label: string;
  actionType: string;
  toolName?: string;
  promptText?: string;
};

export type SuggestedActionsBlock = {
  blockType: 'suggestedActions';
  actions: SuggestedAction[];
};

// Phase 2: Unified visualization — references existing Manual mode analysis views
export type CompactMetric = {
  label: string;
  value: string;
  unit?: string;
};

export type CompactSummary = {
  primaryMetric?: string;
  secondaryMetrics?: CompactMetric[];
  statusText?: string;
  statusIndicator?: 'success' | 'warning' | 'error' | 'info';
};

// Preview data for inline mini-chart (optional - shown before opening modal)
export type AnalysisPreview = {
  frequenciesHz?: number[];
  magnitudesDb?: number[];
};

// Phase 4: Plot hints — deterministic viewer focus hints from DSP evidence
export type PlotHints = {
  focusFrequencyHz?: number | null;
  frequencyRangeMinHz?: number | null;
  frequencyRangeMaxHz?: number | null;
  annotationLabel?: string | null;
  scaleOverride?: 'log' | 'linear' | null;
};

export type AnalysisViewBlock = {
  blockType: 'analysisView';
  viewType: 'spectrum' | 'spectrogram' | 'cpb' | 'soundQuality' | 'findings';
  resultId: string;
  fileId: string;
  fileName: string;
  summary: CompactSummary;
  title?: string;
  preview?: AnalysisPreview;
  plotHints?: PlotHints | null;
};

// Phase 5: Spectrum overlay — multi-file comparison in one chart
export type OverlaySignal = {
  resultId: string;
  fileId: string;
  fileName: string;
  plotHints?: PlotHints | null;
};

export type SpectrumOverlayBlock = {
  blockType: 'spectrumOverlay';
  title: string;
  signals: OverlaySignal[];
  sharedPlotHints?: PlotHints | null;
};

// Phase 6: Multi-tool investigation card
export type InvestigationSignal = {
  resultId: string;
  fileId: string;
  fileName: string;
  viewType: string;
  plotHints?: PlotHints | null;
};

export type InvestigationBlock = {
  blockType: 'investigation';
  diagnosticQuestion: string;
  signals: InvestigationSignal[];
};

export type AgentResponseBlock =
  | MarkdownBlock
  | StatisticsBlock
  | SpectrumChartBlock
  | RankingBlock
  | SuggestedActionsBlock
  | AnalysisViewBlock
  | SpectrumOverlayBlock
  | InvestigationBlock;

export type VisualizationPlanBlockTrace = {
  blockType: string;
  reason: string;
  viewType: string | null;
  sourceEvidenceId: string | null;
};

export type VisualizationPlanTrace = {
  primaryEvidenceType: string;
  blocks: VisualizationPlanBlockTrace[];
};

export type InvestigationTrace = {
  question: string;
  conversationId: string;
  path: string;
  plannedTools: { name: string; arguments: Record<string, unknown> }[];
  toolExecutions: { name: string; status: string; startedAtUtc: string | null; finishedAtUtc: string | null; errorMessage: string | null }[];
  finalAnswer: string;
  confidence: string;
  timestampUtc: string;
  visualizationPlan: VisualizationPlanTrace | null;
};

export type AgentAskResponse = {
  conversationId: string;
  answer: string;
  evidencePackageId: string;
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  suggestedNextSteps: string[];
  toolExecutions: AgentToolExecutionRecord[];
  validationWarning: boolean;
  toolResultsData: Record<string, unknown> | null;
  plannedTools: string[];
  plannerReason: string | null;
  blocks?: AgentResponseBlock[];
  investigationTrace?: InvestigationTrace | null;
  plotHintsMap?: Record<string, PlotHints> | null;
  overlayBlocks?: SpectrumOverlayBlock[] | null;
  investigationBlocks?: InvestigationBlock[] | null;
};

export type AgentConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentAskRequest = {
  question: string;
  selectedFileIds: string[];
  conversationContext?: AgentConversationTurn[];
  projectId?: string;
  mode?: string;
  modelOverride?: string;
};

export async function callAgentAskEndpoint(
  request: AgentAskRequest,
  signal?: AbortSignal,
): Promise<AgentAskResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agent/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(toFriendlyAgentError(response.status, errorText));
  }

  const data = await response.json() as AgentAskResponse;
  return data;
}
