export type ProjectStatus = 'no-project' | 'ready' | 'loading' | 'error';

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

export interface ProjectState {
  projectName: string | null;
  status: ProjectStatus;
  files: AudioFile[];
  regions: Region[];
  markers: Marker[];
  analysisResults: AnalysisResult[];
  activeFileId: AudioFileId | null;
  activeRegionId: RegionId | null;
}

export const initialProjectState: ProjectState = {
  projectName: null,
  status: 'no-project',
  files: [],
  regions: [],
  markers: [],
  analysisResults: [],
  activeFileId: null,
  activeRegionId: null,
};
