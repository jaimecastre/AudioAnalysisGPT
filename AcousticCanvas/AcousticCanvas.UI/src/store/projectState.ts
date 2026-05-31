export type ProjectStatus = 'no-project' | 'ready' | 'loading' | 'error';

export type ActiveMode = 'manual' | 'agent';

export type ProjectId = string;
export type AudioFileId = string;
export type RegionId = string;
export type MarkerId = string;
export type AnalysisResultId = string;

export interface AudioFile {
  id: AudioFileId;
  name: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  fileSizeBytes: number;
}

export interface Region {
  id: RegionId;
  fileId: AudioFileId;
  startSeconds: number;
  endSeconds: number;
  label: string;
}

export interface Marker {
  id: MarkerId;
  fileId: AudioFileId;
  timeSeconds: number;
  label: string;
  source: 'manual' | 'agent';
}

export interface AnalysisResult {
  id: AnalysisResultId;
  fileId: AudioFileId;
  regionId: RegionId | null;
  type: string;
  parameters: Record<string, unknown>;
  output: Record<string, unknown>;
  source: 'manual' | 'agent';
  createdAt: string;
}

export type VisibleView = 'waveform' | 'spectrogram' | 'spectrum';

export interface WorkspaceState {
  visibleViews: VisibleView[];
  activeMarkerId: MarkerId | null;
}

export interface ProjectState {
  id: ProjectId | null;
  projectName: string;
  status: ProjectStatus;
  activeMode: ActiveMode;
  files: AudioFile[];
  regions: Region[];
  markers: Marker[];
  analysisResults: AnalysisResult[];
  activeFileId: AudioFileId | null;
  activeRegionId: RegionId | null;
  workspace: WorkspaceState;
}

export const initialWorkspaceState: WorkspaceState = {
  visibleViews: ['waveform', 'spectrogram', 'spectrum'],
  activeMarkerId: null,
};

export const initialProjectState: ProjectState = {
  id: null,
  projectName: 'Untitled Project',
  status: 'no-project',
  activeMode: 'manual',
  files: [],
  regions: [],
  markers: [],
  analysisResults: [],
  activeFileId: null,
  activeRegionId: null,
  workspace: initialWorkspaceState,
};
