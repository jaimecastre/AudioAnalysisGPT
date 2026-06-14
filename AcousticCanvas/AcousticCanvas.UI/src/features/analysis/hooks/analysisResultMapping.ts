import type { AnalysisResult } from '../store/analysisResultsSlice';
import type { SpectrumPointsResponse } from '../types/spectrumTypes';
import type { SpectrogramAnalysis } from '../types/spectrogramTypes';
import type { SoundQualityAnalysis } from '../types/soundQualityTypes';
import type { CpbAnalysis } from '../types/cpbTypes';
import type { FindingsResult } from '../../findings/types/findingsTypes';

export function mapAnalysisResultResponse(data: { type: string; data: unknown }): AnalysisResult {
  if (data.type === 'spectrum') {
    return { type: 'spectrum', data: data.data as SpectrumPointsResponse };
  }

  if (data.type === 'spectrogram') {
    return { type: 'spectrogram', data: data.data as SpectrogramAnalysis };
  }

  if (data.type === 'soundQuality') {
    return { type: 'soundQuality', data: data.data as SoundQualityAnalysis };
  }

  if (data.type === 'cpb') {
    return { type: 'cpb', data: data.data as CpbAnalysis };
  }

  return { type: 'findings', data: data.data as FindingsResult };
}
