import type { RootState } from '../../store/reduxStore';
import type {
  GetStateResult,
  GetStateActiveFile,
  GetStateActiveSelection,
} from './agentToolTypes';
import { AGENT_CAPABILITIES } from './capabilitiesRegistry';

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

  const hasWaveform = activeFile !== null;
  const visibleViews: GetStateResult['visibleViews'] = [];
  if (hasWaveform) {
    visibleViews.push('waveform');
  }

  return {
    projectName: state.project.projectName,
    projectStatus: state.project.status,
    activeFile,
    activeSelection,
    visibleViews,
    capabilities: AGENT_CAPABILITIES,
  };
}
