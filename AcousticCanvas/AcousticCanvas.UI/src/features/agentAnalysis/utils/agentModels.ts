export type AgentModel = {
  id: string;
  label: string;
  description: string;
  costTier: '$' | '$$' | '$$$' | '$$$$';
};

export const AGENT_MODELS: AgentModel[] = [
  {
    id: 'gpt-4o-mini',
    label: '4o mini',
    description: 'Fast · routine questions',
    costTier: '$',
  },
  {
    id: 'gpt-4o',
    label: '4o',
    description: 'Balanced · complex analysis',
    costTier: '$$',
  },
  {
    id: 'o4-mini',
    label: 'o4-mini',
    description: 'Reasoning · multi-step inference',
    costTier: '$$$',
  },
  {
    id: 'o3',
    label: 'o3',
    description: 'Deep reasoning · hardest diagnostics',
    costTier: '$$$$',
  },
];

export const DEFAULT_MODEL_ID = 'gpt-4o-mini';
