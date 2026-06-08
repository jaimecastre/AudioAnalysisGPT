export type SoundQualityMetric = {
  name: string;
  value: number;
  unit: string;
  method: string;
};

export type SoundQualityAnalysis = {
  parameters: {
    method: string;
    library: string;
    startTimeSeconds: number;
    endTimeSeconds: number;
    sampleRate: number;
    limitations: string[];
  };
  region: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
  loudness: SoundQualityMetric;
  sharpness: SoundQualityMetric;
};
