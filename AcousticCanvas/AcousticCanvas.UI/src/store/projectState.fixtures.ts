import type {
  AudioFile,
  Region,
  Marker,
  AnalysisResult,
  WorkspaceState,
  ProjectState,
} from './projectState';

export const fixtureAudioFile: AudioFile = {
  id: 'file-001',
  name: 'kick_drum.wav',
  durationSeconds: 2.5,
  sampleRate: 44100,
  channels: 1,
  bitDepth: 24,
  fileSizeBytes: 220500,
};

export const fixtureRegion: Region = {
  id: 'region-001',
  fileId: 'file-001',
  startSeconds: 0.1,
  endSeconds: 0.9,
  label: 'Transient',
};

export const fixtureMarker: Marker = {
  id: 'marker-001',
  fileId: 'file-001',
  timeSeconds: 0.5,
  label: 'Peak',
  source: 'manual',
};

export const fixtureAnalysisResult: AnalysisResult = {
  id: 'result-001',
  fileId: 'file-001',
  regionId: 'region-001',
  type: 'rms',
  parameters: { windowSize: 1024 },
  output: { rmsDb: -12.4 },
  source: 'manual',
  createdAt: '2025-01-01T00:00:00.000Z',
};

export const fixtureWorkspaceState: WorkspaceState = {
  visibleViews: ['waveform', 'spectrogram'],
  activeMarkerId: 'marker-001',
};

export const fixtureProjectState: ProjectState = {
  id: 'project-001',
  projectName: 'Test Project',
  status: 'ready',
  activeMode: 'manual',
  files: [fixtureAudioFile],
  regions: [fixtureRegion],
  markers: [fixtureMarker],
  analysisResults: [fixtureAnalysisResult],
  activeFileId: 'file-001',
  activeRegionId: 'region-001',
  workspace: fixtureWorkspaceState,
};
