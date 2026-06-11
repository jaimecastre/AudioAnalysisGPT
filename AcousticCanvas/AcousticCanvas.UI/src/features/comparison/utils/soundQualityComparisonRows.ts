import type { CompareSoundQuality, CompareSoundQualityDelta } from '../../agent/types/agentToolTypes';

export type SoundQualityRow = {
  label: 'Loudness' | 'Sharpness' | 'Roughness';
  unit: 'sone' | 'acum' | 'asper';
  valueA: string;
  valueB: string;
  delta: number;
  higherLabel: string;
};

type BuildSoundQualityRowsInput = {
  soundQualityA: CompareSoundQuality;
  soundQualityB: CompareSoundQuality;
  soundQualityDelta: CompareSoundQualityDelta;
  fileIdA: string;
  fileIdB: string;
  labelA: string;
  labelB: string;
};

function mapFileIdToLabel(
  winnerFileId: string,
  fileIdA: string,
  fileIdB: string,
  labelA: string,
  labelB: string,
): string {
  if (winnerFileId === fileIdA) {
    return labelA;
  }

  if (winnerFileId === fileIdB) {
    return labelB;
  }

  return '—';
}

export function buildSoundQualityRows(input: BuildSoundQualityRowsInput): SoundQualityRow[] {
  return [
    {
      label: 'Loudness',
      unit: 'sone',
      valueA: input.soundQualityA.loudnessSone.toFixed(2),
      valueB: input.soundQualityB.loudnessSone.toFixed(2),
      delta: input.soundQualityDelta.loudnessDeltaSone,
      higherLabel: mapFileIdToLabel(
        input.soundQualityDelta.louderFileId,
        input.fileIdA,
        input.fileIdB,
        input.labelA,
        input.labelB,
      ),
    },
    {
      label: 'Sharpness',
      unit: 'acum',
      valueA: input.soundQualityA.sharpnessAcum.toFixed(3),
      valueB: input.soundQualityB.sharpnessAcum.toFixed(3),
      delta: input.soundQualityDelta.sharpnessDeltaAcum,
      higherLabel: mapFileIdToLabel(
        input.soundQualityDelta.sharperFileId,
        input.fileIdA,
        input.fileIdB,
        input.labelA,
        input.labelB,
      ),
    },
    {
      label: 'Roughness',
      unit: 'asper',
      valueA: input.soundQualityA.roughnessAsper.toFixed(4),
      valueB: input.soundQualityB.roughnessAsper.toFixed(4),
      delta: input.soundQualityDelta.roughnessDeltaAsper,
      higherLabel: mapFileIdToLabel(
        input.soundQualityDelta.rougherFileId,
        input.fileIdA,
        input.fileIdB,
        input.labelA,
        input.labelB,
      ),
    },
  ];
}

export function getSoundQualityUnavailableMessage(unavailableReason?: string): string {
  if (unavailableReason && unavailableReason.trim().length > 0) {
    return unavailableReason;
  }

  return 'Sound-quality comparison is unavailable for this pair. Run compare again with the Python sidecar enabled.';
}
