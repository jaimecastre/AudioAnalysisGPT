import type { RootState } from '../../../store/reduxStore';
import type {
  GetStateResult,
  GetStateActiveFile,
  GetStateActiveSelection,
} from '../types/agentToolTypes';
import { CAPABILITY_REGISTRY } from '../utils/capabilitiesRegistry';

function buildActiveFile(state: RootState): GetStateActiveFile | null {
  const allFiles = state.project.files;
  const selectedSignalId = state.project.selectedSignalId;

  if (allFiles.length === 0 || selectedSignalId === null) {
    return null;
  }

  const matchingFile = allFiles.find((file) => file.id === selectedSignalId);
  if (!matchingFile) {
    return null;
  }

  return {
    id: matchingFile.id,
    name: matchingFile.name,
    durationSeconds: matchingFile.durationSeconds,
    sampleRate: matchingFile.sampleRate,
    channels: matchingFile.channels,
    bitDepth: matchingFile.bitDepth,
  };
}

function buildActiveSelection(state: RootState): GetStateActiveSelection | null {
  const selection = state.waveformSelection.activeSelection;

  if (!selection) {
    return null;
  }

  const hasValidRange = selection.endSeconds > selection.startSeconds;
  if (!hasValidRange) {
    return null;
  }

  return {
    startSeconds: selection.startSeconds,
    endSeconds: selection.endSeconds,
    durationSeconds: selection.endSeconds - selection.startSeconds,
  };
}

export function getStateSelector(state: RootState): GetStateResult {
  const activeFile = buildActiveFile(state);
  const activeSelection = buildActiveSelection(state);

  const loadedFiles = state.project.files.map((file) => ({
    id: file.id,
    name: file.name,
    durationSeconds: file.durationSeconds,
    sampleRate: file.sampleRate,
    channels: file.channels,
    bitDepth: file.bitDepth,
  }));

  const hasWaveform = activeFile !== null;
  const visibleViews: GetStateResult['visibleViews'] = [];
  if (hasWaveform) {
    visibleViews.push('waveform');
  }

  return {
    projectName: state.project.projectName,
    projectStatus: state.project.status,
    loadedFiles,
    activeFile,
    activeSelection,
    visibleViews,
    capabilities: CAPABILITY_REGISTRY,
  };
}
