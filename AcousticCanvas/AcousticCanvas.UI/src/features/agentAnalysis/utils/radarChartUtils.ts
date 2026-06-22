import type { SoundQualitySignal } from '../services/agentAskService';

const RADAR_COLORS = [
  'blue.5',
  'orange.5',
  'teal.5',
  'violet.5',
  'pink.5',
  'green.5',
  'yellow.5',
  'red.5',
];

type RadarRow = Record<string, number | string>;

type RadarChartInput = {
  data: RadarRow[];
  series: Array<{ name: string; color: string; opacity: number }>;
};

export function buildRadarChartInput(signals: SoundQualitySignal[]): RadarChartInput {
  const maxLoudness = Math.max(...signals.map((s) => s.loudnessSone));
  const maxSharpness = Math.max(...signals.map((s) => s.sharpnessAcum));
  const maxRoughness = Math.max(...signals.map((s) => s.roughnessAsper));

  const normalize = (value: number, max: number): number =>
    max === 0 ? 0 : Math.round((value / max) * 100);

  const loudnessRow: RadarRow = { metric: 'Loudness' };
  const sharpnessRow: RadarRow = { metric: 'Sharpness' };
  const roughnessRow: RadarRow = { metric: 'Roughness' };

  for (const signal of signals) {
    loudnessRow[signal.fileName] = normalize(signal.loudnessSone, maxLoudness);
    sharpnessRow[signal.fileName] = normalize(signal.sharpnessAcum, maxSharpness);
    roughnessRow[signal.fileName] = normalize(signal.roughnessAsper, maxRoughness);
  }

  const series = signals.map((signal, index) => ({
    name: signal.fileName,
    color: RADAR_COLORS[index % RADAR_COLORS.length],
    opacity: 0.2,
  }));

  return { data: [loudnessRow, sharpnessRow, roughnessRow], series };
}
