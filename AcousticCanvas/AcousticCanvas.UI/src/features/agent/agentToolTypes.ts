export type AgentToolName = 'getState' | 'analyze' | 'compare' | 'find' | 'workspace' | 'report';

export type AgentCapability = {
  tool: AgentToolName;
  description: string;
};

export type GetStateActiveFile = {
  id: string;
  name: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
};

export type GetStateActiveSelection = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export type GetStateAnalysisSummary = {
  id: string;
  type: string;
  fileId: string;
  source: 'manual' | 'agent';
  createdAt: string;
};

export type GetStateVisibleView = 'waveform' | 'spectrogram' | 'spectrum';

export type AnalysisKindEntry = {
  kind: string;
  description: string;
  requiresRegion: boolean;
  defaultOptions: Record<string, unknown>;
};

export type EventKindEntry = {
  kind: string;
  description: string;
  defaultOptions: Record<string, unknown>;
};

export type CapabilityRegistry = {
  tools: AgentCapability[];
  analysisKinds: AnalysisKindEntry[];
  eventKinds: EventKindEntry[];
};

export type GetStateResult = {
  projectName: string;
  projectStatus: 'no-project' | 'loading' | 'ready' | 'error';
  activeFile: GetStateActiveFile | null;
  activeSelection: GetStateActiveSelection | null;
  visibleViews: GetStateVisibleView[];
  capabilities: CapabilityRegistry;
};

export type WorkspaceActionSetActiveFile = {
  action: 'set_active_file';
  fileId: string;
};

export type WorkspaceActionSetSelection = {
  action: 'set_selection';
  startSeconds: number;
  endSeconds: number;
};

export type WorkspaceActionOpenView = {
  action: 'open_view';
  view: 'waveform' | 'spectrogram' | 'spectrum';
};

export type WorkspaceActionCloseView = {
  action: 'close_view';
  view: 'waveform' | 'spectrogram' | 'spectrum';
};

export type WorkspaceActionAddMarker = {
  action: 'add_marker';
  fileId: string;
  timeSeconds: number;
  label: string;
};

export type WorkspaceActionSetLoopRegion = {
  action: 'set_loop_region';
  startSeconds: number;
  endSeconds: number;
};

export type WorkspaceAction =
  | WorkspaceActionSetActiveFile
  | WorkspaceActionSetSelection
  | WorkspaceActionOpenView
  | WorkspaceActionCloseView
  | WorkspaceActionAddMarker
  | WorkspaceActionSetLoopRegion;

export type WorkspaceResult = {
  appliedAction: string;
  success: boolean;
  detail: string;
};

export type AnalysisKind = 'file_info' | 'level' | 'spectrum';

export type AnalyzeInput = {
  kind: AnalysisKind;
  fileId: string;
  startSeconds: number | null;
  endSeconds: number | null;
};

export type AgentAnalysisResult = {
  kind: AnalysisKind;
  fileId: string;
  regionStart: number | null;
  regionEnd: number | null;
  summary: Record<string, unknown>;
  ranAt: string;
};
