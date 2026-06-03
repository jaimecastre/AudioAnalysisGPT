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
  loadedFiles: GetStateActiveFile[];
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

export type SemanticAnalyzeKind =
  | 'loudness'
  | 'peaks'
  | 'dynamics'
  | 'spectral_balance'
  | 'noise'
  | 'stereo_phase'
  | 'distortion'
  | 'dialogue_clarity';

export type SpectralFocus =
  | 'general'
  | 'muddy'
  | 'boomy'
  | 'boxy'
  | 'harsh'
  | 'sibilant'
  | 'thin'
  | 'dull';

export type AnalyzeInput = {
  kind: AnalysisKind;
  fileId: string;
  startSeconds: number | null;
  endSeconds: number | null;
  focus?: SpectralFocus | null;
};

export type AgentAnalysisResult = {
  kind: AnalysisKind;
  fileId: string;
  regionStart: number | null;
  regionEnd: number | null;
  parameters?: Record<string, unknown>;
  fromCache?: boolean;
  summary: Record<string, unknown>;
  ranAt: string;
};

export type CompareInput = {
  fileIds: string[];
  startSeconds: number | null;
  endSeconds: number | null;
};

export type CompareSpectrumCurve = {
  frequenciesHz: number[];
  magnitudesDb: (number | null)[];
  fftSize: number;
  overlap: number;
};

export type CompareSpectrumDelta = {
  frequenciesHz: number[];
  deltaDb: (number | null)[];
};

export type CompareBandEnergy = {
  bandName: string;
  lowHz: number;
  highHz: number;
  energyDb: number;
};

export type CompareFileSummary = {
  fileId: string;
  fileName: string;
  peakDb: number;
  rmsDb: number;
  crestFactorDb: number;
  peakFrequencyHz: number;
  peakFrequencyMagnitudeDb: number;
  regionStartSeconds: number;
  regionEndSeconds: number;
  spectrumCurve: CompareSpectrumCurve;
  bandEnergies: CompareBandEnergy[];
};

export type PairwiseDiff = {
  fileIdA: string;
  fileIdB: string;
  peakDeltaDb: number;
  higherPeakFileId: string;
  rmsDeltaDb: number;
  higherRmsFileId: string;
  crestFactorDeltaDb: number;
  higherCrestFactorFileId: string;
  peakFrequencyDeltaHz: number;
  higherPeakFrequencyFileId: string;
  spectrumDelta: CompareSpectrumDelta;
  bandEnergyDeltas: CompareBandEnergy[];
};

export type CompareResult = {
  files: CompareFileSummary[];
  pairwiseDiffs: PairwiseDiff[];
  ranAt: string;
};

export type FindEventKind = 'clipping' | 'silence' | 'loudest' | 'transient';

export type FindInput = {
  fileId: string;
  kind: FindEventKind;
  startSeconds: number | null;
  endSeconds: number | null;
};

export type AudioEvent = {
  kind: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  description: string;
  metadata: Record<string, unknown>;
};

export type FindEventsResult = {
  fileId: string;
  kind: string;
  events: AudioEvent[];
  eventCount: number;
  regionStartSeconds: number;
  regionEndSeconds: number;
  ranAt: string;
};
