import type { ToolResultRow } from '../agentWorkspaceSlice';

function fmtDb(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(2)} dBFS` : String(value);
}

function fmtHz(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(0)} Hz` : String(value);
}

function fmtSq(value: unknown, unit: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(3)} ${unit ?? ''}`.trim() : String(value);
}

function fmtSeconds(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(3)}s` : String(value);
}

export function extractAgentToolRows(toolName: string, raw: unknown): ToolResultRow[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  if (toolName === 'get_metadata') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const firstResult = results[0];
    const rows: ToolResultRow[] = [
      { label: 'file', value: String(firstResult['fileName'] ?? '') },
      { label: 'duration', value: typeof firstResult['durationSeconds'] === 'number' ? `${(firstResult['durationSeconds'] as number).toFixed(2)}s` : '' },
      { label: 'sample rate', value: fmtHz(firstResult['sampleRateHz']) },
      { label: 'channels', value: String(firstResult['channels'] ?? '') },
      { label: 'bit depth', value: String(firstResult['bitDepth'] ?? '') },
    ];
    if (results.length > 1) rows.push({ label: 'files', value: String(results.length) });
    return rows;
  }

  if (toolName === 'run_basic_metrics') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const result of results) {
      const metrics = result['metrics'] as Record<string, unknown> | undefined;
      if (!metrics) continue;
      const prefix = results.length > 1 ? `${String(result['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}RMS`, value: fmtDb(metrics['rmsDbFs']) });
      rows.push({ label: `${prefix}peak`, value: fmtDb(metrics['peakDbFs']) });
      rows.push({ label: `${prefix}crest factor`, value: fmtDb(metrics['crestFactorDb']) });
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_event_detection') {
    const kind = String(data['kind'] ?? '');
    const count = data['eventCount'];
    const events = data['events'] as Array<Record<string, unknown>> | undefined;
    const rows: ToolResultRow[] = [
      { label: 'kind', value: kind.replace(/_/g, ' ') },
      { label: 'events found', value: String(count ?? 0) },
    ];
    if (events) {
      for (const event of events.slice(0, 5)) {
        const time = typeof event['startSeconds'] === 'number' ? `${(event['startSeconds'] as number).toFixed(3)}s` : '';
        rows.push({ label: time, value: String(event['description'] ?? '') });
      }
    }
    return rows;
  }

  if (toolName === 'run_spectrum') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const result of results) {
      const summary = result['summary'] as Record<string, unknown> | undefined;
      if (!summary) continue;
      const prefix = results.length > 1 ? `${String(result['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}peak frequency`, value: fmtHz(summary['peakFrequencyHz']) });
      rows.push({ label: `${prefix}max magnitude`, value: fmtDb(summary['maxMagnitudeDb']) });
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_spectrogram') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const result of results) {
      const prefix = results.length > 1 ? `${String(result['fileId']).slice(-4)} ` : '';
      const region = result['region'] as Record<string, unknown> | undefined;
      const parameters = result['parameters'] as Record<string, unknown> | undefined;
      const summary = result['summary'] as Record<string, unknown> | undefined;

      if (region) {
        rows.push({
          label: `${prefix}region`,
          value: `${fmtSeconds(region['startSeconds'])} - ${fmtSeconds(region['endSeconds'])}`,
        });
      }
      if (parameters) {
        rows.push({ label: `${prefix}scale`, value: String(parameters['scale'] ?? '') });
        rows.push({ label: `${prefix}FFT size`, value: String(parameters['fftSize'] ?? '') });
      }
      if (summary) {
        rows.push({ label: `${prefix}frames`, value: String(summary['frameCount'] ?? '') });
        rows.push({ label: `${prefix}bins`, value: String(summary['binCount'] ?? '') });
        rows.push({ label: `${prefix}Nyquist`, value: fmtHz(summary['nyquistHz']) });
      }
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_cpb') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const result of results) {
      const prefix = results.length > 1 ? `${String(result['fileId']).slice(-4)} ` : '';
      rows.push({ label: `${prefix}band mode`, value: String(result['bandMode'] ?? '') });
      rows.push({ label: `${prefix}weighting`, value: String(result['weighting'] ?? 'Z') });
      const summary = result['summary'] as Record<string, unknown> | undefined;
      const bands = summary?.['highestBands'] as Array<Record<string, unknown>> | undefined;
      if (bands) {
        for (const band of bands.slice(0, 3)) {
          rows.push({ label: String(band['label'] ?? ''), value: fmtDb(band['levelDb']) });
        }
      }
    }
    return rows.length ? rows : null;
  }

  if (toolName === 'run_sound_quality_metrics') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (!results?.length) return null;
    const rows: ToolResultRow[] = [];
    for (const result of results) {
      const prefix = results.length > 1 ? `${String(result['fileId']).slice(-4)} ` : '';
      const loudness = result['loudness'] as Record<string, unknown> | undefined;
      const sharpness = result['sharpness'] as Record<string, unknown> | undefined;
      const roughness = result['roughness'] as Record<string, unknown> | undefined;
      if (loudness) rows.push({ label: `${prefix}loudness`, value: fmtSq(loudness['value'], loudness['unit']) });
      if (sharpness) rows.push({ label: `${prefix}sharpness`, value: fmtSq(sharpness['value'], sharpness['unit']) });
      if (roughness) rows.push({ label: `${prefix}roughness`, value: fmtSq(roughness['value'], roughness['unit']) });
    }
    return rows.length ? rows : null;
  }

  return null;
}
