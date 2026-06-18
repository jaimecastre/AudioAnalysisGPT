export type FindingSeverity = 'low' | 'medium' | 'high';

export type FindingConfidence = 'observed' | 'inferred';

export type Finding = {
  findingId: string;
  fileId: string;
  type: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  startSeconds: number | null;
  endSeconds: number | null;
  frequencyHz: number | null;
  suggestedNextStep: string;
  generatedAt: string;
};

export type SavedFinding = Finding & {
  fileName: string;
  savedAt: string;
};

export type FindingsResult = {
  fileId: string;
  findings: Finding[];
  findingCount: number;
  ranAt: string;
};
