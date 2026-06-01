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

export type GetStateResult = {
  projectName: string;
  projectStatus: 'no-project' | 'loading' | 'ready' | 'error';
  activeFile: GetStateActiveFile | null;
  activeSelection: GetStateActiveSelection | null;
  visibleViews: GetStateVisibleView[];
  capabilities: AgentCapability[];
};
