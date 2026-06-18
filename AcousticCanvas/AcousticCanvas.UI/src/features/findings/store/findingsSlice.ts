import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { Finding, FindingsResult, SavedFinding } from '../types/findingsTypes';

export type FindingsStatus = 'idle' | 'running' | 'complete' | 'error';
export const SAVED_FINDINGS_STORAGE_KEY = 'acousticcanvas.savedFindings';

export interface IFindingsState {
  result: FindingsResult | null;
  status: FindingsStatus;
  error: string | null;
  showPanel: boolean;
  savedFindings: SavedFinding[];
}

function readSavedFindingsFromStorage(): SavedFinding[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(SAVED_FINDINGS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((item): item is SavedFinding => {
      return typeof item === 'object' &&
        item !== null &&
        typeof item.findingId === 'string' &&
        typeof item.fileName === 'string' &&
        typeof item.savedAt === 'string';
    });
  } catch {
    return [];
  }
}

const initialState: IFindingsState = {
  result: null,
  status: 'idle',
  error: null,
  showPanel: false,
  savedFindings: readSavedFindingsFromStorage(),
};

export const runFindingsAnalysis = createAsyncThunk<FindingsResult, string>(
  'findings/runFindingsAnalysis',
  async (fileId: string) => {
    const result = await apiClient.requestJson<FindingsResult>(
      API_ENDPOINTS.AUDIO.RUN_FINDINGS,
      {
        method: HttpMethod.POST,
        body: { fileId },
      },
    );
    return result;
  },
);

const findingsSlice = createSlice({
  name: 'findings',
  initialState,
  reducers: {
    findingsClear: (state) => {
      state.result = null;
      state.status = 'idle';
      state.error = null;
      state.showPanel = false;
    },
    findingsPanelOpened: (state) => {
      state.showPanel = true;
    },
    findingsPanelClosed: (state) => {
      state.showPanel = false;
    },
    findingPinned: (state, action: PayloadAction<{ finding: Finding; fileName: string; savedAt?: string }>) => {
      const savedFinding: SavedFinding = {
        ...action.payload.finding,
        fileName: action.payload.fileName,
        savedAt: action.payload.savedAt ?? new Date().toISOString(),
      };

      state.savedFindings = [
        savedFinding,
        ...state.savedFindings.filter((finding) => finding.findingId !== savedFinding.findingId),
      ];
    },
    findingUnpinned: (state, action: PayloadAction<string>) => {
      state.savedFindings = state.savedFindings.filter((finding) => finding.findingId !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(runFindingsAnalysis.pending, (state) => {
      state.status = 'running';
      state.error = null;
    });
    builder.addCase(runFindingsAnalysis.fulfilled, (state, action: PayloadAction<FindingsResult>) => {
      state.status = 'complete';
      state.result = action.payload;
      state.error = null;
    });
    builder.addCase(runFindingsAnalysis.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.error.message ?? 'Findings analysis failed';
    });
  },
});

export const {
  findingsClear,
  findingsPanelOpened,
  findingsPanelClosed,
  findingPinned,
  findingUnpinned,
} = findingsSlice.actions;

export default findingsSlice.reducer;

export const findingsResultSelector = (state: { findings: IFindingsState }): FindingsResult | null =>
  state.findings.result;

export const findingsStatusSelector = (state: { findings: IFindingsState }): FindingsStatus =>
  state.findings.status;

export const findingsErrorSelector = (state: { findings: IFindingsState }): string | null =>
  state.findings.error;

export const findingsShowPanelSelector = (state: { findings: IFindingsState }): boolean =>
  state.findings.showPanel;

export const savedFindingsSelector = (state: { findings: IFindingsState }): SavedFinding[] =>
  state.findings.savedFindings;
