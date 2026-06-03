export type ExpectedRoute = {
  toolName: 'analyze' | 'find' | 'compare' | 'workspace' | 'getState' | 'unknown';
  args: Record<string, unknown>;
};

export type IntentRoutingFixture = {
  name: string;
  user: string;
  expected: ExpectedRoute;
};

export const INTENT_ROUTING_FIXTURES: IntentRoutingFixture[] = [
  {
    name: 'analyze-level-too-loud',
    user: 'Is this too loud?',
    expected: {
      toolName: 'analyze',
      args: { kind: 'loudness' },
    },
  },
  {
    name: 'analyze-level-loudness-check',
    user: 'Check the loudness.',
    expected: {
      toolName: 'analyze',
      args: { kind: 'loudness' },
    },
  },
  {
    name: 'analyze-spectrum-fft-alias',
    user: 'Can you run FFT around this region?',
    expected: {
      toolName: 'analyze',
      args: { kind: 'spectral_balance', focus: 'general' },
    },
  },
  {
    name: 'analyze-file-info-metadata',
    user: 'Show file metadata and sample rate.',
    expected: {
      toolName: 'analyze',
      args: { kind: 'file_info' },
    },
  },
  {
    name: 'find-clicks-alias',
    user: 'Find clicks in this file.',
    expected: {
      toolName: 'find',
      args: { kind: 'transient' },
    },
  },
  {
    name: 'find-clipping',
    user: 'Is there clipping?',
    expected: {
      toolName: 'find',
      args: { kind: 'clipping' },
    },
  },
  {
    name: 'find-silence',
    user: 'Find silence gaps.',
    expected: {
      toolName: 'find',
      args: { kind: 'silence' },
    },
  },
  {
    name: 'find-loudest',
    user: 'Where is the loudest moment?',
    expected: {
      toolName: 'find',
      args: { kind: 'loudest' },
    },
  },
  {
    name: 'compare-files',
    user: 'Compare these two files.',
    expected: {
      toolName: 'compare',
      args: {},
    },
  },
  {
    name: 'workspace-add-marker',
    user: 'Add a marker here.',
    expected: {
      toolName: 'workspace',
      args: { action: 'add_marker' },
    },
  },
  {
    name: 'workspace-add-marker-negated',
    user: "Don't add a marker.",
    expected: {
      toolName: 'unknown',
      args: {},
    },
  },
  {
    name: 'workspace-set-selection',
    user: 'Set loop region from selection.',
    expected: {
      toolName: 'workspace',
      args: { action: 'set_selection' },
    },
  },
  {
    name: 'find-clipping-negated',
    user: 'Do not check clipping right now.',
    expected: {
      toolName: 'unknown',
      args: {},
    },
  },
  {
    name: 'clip-ambiguity-duration-question',
    user: 'How long is this clip?',
    expected: {
      toolName: 'analyze',
      args: { kind: 'file_info' },
    },
  },
  {
    name: 'compare-different-between',
    user: 'What is the difference between these takes?',
    expected: {
      toolName: 'compare',
      args: {},
    },
  },
  {
    name: 'spectral-balance-boxy',
    user: 'The dialogue feels boxy.',
    expected: {
      toolName: 'analyze',
      args: { kind: 'spectral_balance', focus: 'boxy' },
    },
  },
  {
    name: 'spectral-balance-congested',
    user: 'Why does this feel congested?',
    expected: {
      toolName: 'analyze',
      args: { kind: 'spectral_balance', focus: 'muddy' },
    },
  },
  {
    name: 'get-state',
    user: 'What file is loaded right now?',
    expected: {
      toolName: 'getState',
      args: {},
    },
  },
  {
    name: 'unknown-no-tool-needed',
    user: 'What does crest factor mean?',
    expected: {
      toolName: 'unknown',
      args: {},
    },
  },
];
