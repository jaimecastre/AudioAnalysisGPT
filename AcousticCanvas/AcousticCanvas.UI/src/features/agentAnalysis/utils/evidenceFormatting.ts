export type AgentEvidenceItem = {
  evidenceId: string;
  type: string;
  data: Record<string, unknown>;
};

export type EvidenceDisplayRow = {
  label: string;
  value: string;
};

const EVIDENCE_LABELS: Record<string, string> = {
  basic_metrics: 'Basic metrics',
  level_comparison: 'Level comparison',
  spectrum: 'Spectrum',
  spectrogram: 'Spectrogram',
  spectrum_comparison: 'Spectrum comparison',
  cpb: 'CPB',
  metadata: 'Metadata',
  event_detection: 'Event detection',
  sound_quality: 'Sound quality',
  sound_quality_comparison: 'Sound quality comparison',
  findings: 'Findings',
};

const KNOWN_ROW_ORDER = [
  'fileName',
  'fileNameA',
  'fileNameB',
  'peakDb',
  'rmsDb',
  'peakDbFs',
  'rmsDbFs',
  'crestFactorDb',
  'dcOffsetLinear',
  'rmsADbFs',
  'rmsBDbFs',
  'rmsDeltaDb',
  'peakADbFs',
  'peakBDbFs',
  'peakDeltaDb',
  'peakFrequencyHz',
  'peakFrequencyAHz',
  'peakFrequencyBHz',
  'peakFrequencyDeltaHz',
  'maxMagnitudeDb',
  'maxMagnitudeADb',
  'maxMagnitudeBDb',
  'maxMagnitudeDeltaDb',
  'scale',
  'fftSize',
  'frameCount',
  'binCount',
  'nyquistHz',
  'bandMode',
  'method',
  'loudnessSone',
  'sharpnessAcum',
  'roughnessAsper',
  'loudnessASone',
  'loudnessBSone',
  'loudnessDeltaSone',
  'sharpnessAAcum',
  'sharpnessBAcum',
  'sharpnessDeltaAcum',
  'roughnessAAsper',
  'roughnessBAsper',
  'roughnessDeltaAsper',
  'regionStartSeconds',
  'regionEndSeconds',
  'durationSeconds',
  'sampleRateHz',
  'channels',
  'bitDepth',
  'kind',
  'eventCount',
  'eventsDetected',
  'findingCount',
];

const HIDDEN_KEYS = new Set([
  'type',
  'fileId',
  'fileIdA',
  'fileIdB',
  'louderFileId',
  'higherPeakFileId',
  'moreDynamicFileId',
  'sharperFileId',
  'rougherFileId',
  'dataRef',
  'dominantPeaks',
  'dominantPeaksA',
  'dominantPeaksB',
  'spectrumDbUnit',
  'highestBands',
  'findings',
  'firstEvents',
  'levelDbUnit',
]);

const LABELS: Record<string, string> = {
  fileName: 'file',
  fileNameA: 'file A',
  fileNameB: 'file B',
  peakDb: 'peak',
  rmsDb: 'RMS',
  peakDbFs: 'peak',
  rmsDbFs: 'RMS',
  crestFactorDb: 'crest factor',
  dcOffsetLinear: 'DC offset',
  rmsADbFs: 'RMS A',
  rmsBDbFs: 'RMS B',
  rmsDeltaDb: 'RMS delta',
  peakADbFs: 'peak A',
  peakBDbFs: 'peak B',
  peakDeltaDb: 'peak delta',
  peakFrequencyHz: 'peak frequency',
  peakFrequencyAHz: 'peak frequency A',
  peakFrequencyBHz: 'peak frequency B',
  peakFrequencyDeltaHz: 'peak frequency delta',
  maxMagnitudeDb: 'max magnitude',
  maxMagnitudeADb: 'max magnitude A',
  maxMagnitudeBDb: 'max magnitude B',
  maxMagnitudeDeltaDb: 'max magnitude delta',
  fftSize: 'FFT size',
  frameCount: 'frames',
  binCount: 'bins',
  nyquistHz: 'Nyquist',
  bandMode: 'band mode',
  loudnessSone: 'loudness',
  sharpnessAcum: 'sharpness',
  roughnessAsper: 'roughness',
  loudnessASone: 'loudness A',
  loudnessBSone: 'loudness B',
  loudnessDeltaSone: 'loudness delta',
  sharpnessAAcum: 'sharpness A',
  sharpnessBAcum: 'sharpness B',
  sharpnessDeltaAcum: 'sharpness delta',
  roughnessAAsper: 'roughness A',
  roughnessBAsper: 'roughness B',
  roughnessDeltaAsper: 'roughness delta',
  regionStartSeconds: 'region start',
  regionEndSeconds: 'region end',
  durationSeconds: 'duration',
  sampleRateHz: 'sample rate',
  eventCount: 'events found',
  eventsDetected: 'events detected',
  findingCount: 'findings',
};

export function getEvidenceLabel(type: string): string {
  const knownLabel = EVIDENCE_LABELS[type];
  if (knownLabel) return knownLabel;

  return type
    .split('_')
    .filter((token) => token.length > 0)
    .map((token, index) => index === 0 ? token.charAt(0).toUpperCase() + token.slice(1) : token)
    .join(' ');
}

export function buildEvidenceRows(item: AgentEvidenceItem): EvidenceDisplayRow[] {
  const rows: EvidenceDisplayRow[] = [];
  const emittedKeys = new Set<string>();

  for (const key of KNOWN_ROW_ORDER) {
    const value = item.data[key];
    if (value === undefined || value === null) continue;

    rows.push({ label: getRowLabel(key), value: formatEvidenceValue(key, value, item.data) });
    emittedKeys.add(key);
  }

  for (const [key, value] of Object.entries(item.data)) {
    if (emittedKeys.has(key) || HIDDEN_KEYS.has(key) || value === undefined || value === null) continue;
    if (Array.isArray(value) || typeof value === 'object') continue;

    rows.push({ label: getRowLabel(key), value: formatEvidenceValue(key, value, item.data) });
  }

  return rows.slice(0, 8);
}

function getRowLabel(key: string): string {
  const knownLabel = LABELS[key];
  if (knownLabel) return knownLabel;

  return key
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase();
}

function formatEvidenceValue(key: string, value: unknown, data: Record<string, unknown> = {}): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  if (typeof value !== 'number') {
    return String(value);
  }

  if (key === 'peakDb' || key === 'rmsDb' || key.endsWith('DbFs')) {
    const unit = typeof data['levelDbUnit'] === 'string' ? data['levelDbUnit'] : 'dB SPL';
    return `${value.toFixed(2)} ${unit}`;
  }

  if (key === 'maxMagnitudeDb') {
    const unit = typeof data['spectrumDbUnit'] === 'string' ? data['spectrumDbUnit'] : 'dB SPL';
    return `${value.toFixed(2)} ${unit}`;
  }

  if (key.endsWith('Db')) {
    return `${value.toFixed(2)} dB`;
  }

  if (key.endsWith('Hz')) {
    return `${value.toFixed(0)} Hz`;
  }

  if (key.endsWith('Sone')) {
    return `${value.toFixed(3)} sone`;
  }

  if (key.endsWith('Acum')) {
    return `${value.toFixed(3)} acum`;
  }

  if (key.endsWith('Asper')) {
    return `${value.toFixed(3)} asper`;
  }

  if (key.endsWith('Seconds')) {
    return `${value.toFixed(3)} s`;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
