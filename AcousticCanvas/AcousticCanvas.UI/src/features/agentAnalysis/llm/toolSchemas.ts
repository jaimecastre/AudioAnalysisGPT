export type OpenAiToolSchema = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
};

export const GET_STATE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'getState',
    description: 'Returns a snapshot of the current workspace: active file metadata, active time selection, visible views, and available analysis capabilities. Always call this first before running any analysis.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
};

export const ANALYZE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'analyze',
    description: 'Runs a named analysis on the active file or a selected region and returns measured results. Supports both legacy kinds (file_info, level, spectrum) and semantic kinds (loudness, peaks, dynamics, spectral_balance, noise, stereo_phase, distortion, dialogue_clarity).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['file_info', 'level', 'spectrum', 'loudness', 'peaks', 'dynamics', 'spectral_balance', 'noise', 'stereo_phase', 'distortion', 'dialogue_clarity'],
          description: 'The type of analysis to run. Semantic kinds are mapped to deterministic backend analyzers.',
        },
        focus: {
          type: ['string', 'null'],
          enum: ['general', 'muddy', 'boomy', 'boxy', 'harsh', 'sibilant', 'thin', 'dull', null],
          description: 'Optional semantic focus for spectral_balance-style requests. Ignored for kinds that do not use focus.',
        },
        fileId: {
          type: 'string',
          description: 'The ID of the file to analyse. Obtained from getState().',
        },
        startSeconds: {
          type: ['number', 'null'],
          description: 'Start of the region to analyse in seconds. Omit to analyse the full file.',
        },
        endSeconds: {
          type: ['number', 'null'],
          description: 'End of the region to analyse in seconds. Omit to analyse the full file.',
        },
      },
      required: ['kind', 'focus', 'fileId', 'startSeconds', 'endSeconds'],
      additionalProperties: false,
    },
  },
};

export const WORKSPACE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'workspace',
    description: 'Updates the workspace state. Use to add markers, set a time selection, open or close views, or change the active file.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_active_file', 'set_selection', 'open_view', 'close_view', 'add_marker', 'set_loop_region'],
          description: 'The workspace action to perform.',
        },
        fileId: {
          type: ['string', 'null'],
          description: 'Required for set_active_file and add_marker.',
        },
        startSeconds: {
          type: ['number', 'null'],
          description: 'Required for set_selection and set_loop_region.',
        },
        endSeconds: {
          type: ['number', 'null'],
          description: 'Required for set_selection and set_loop_region.',
        },
        view: {
          type: ['string', 'null'],
          enum: ['waveform', 'spectrogram', 'spectrum'],
          description: 'Required for open_view and close_view.',
        },
        timeSeconds: {
          type: ['number', 'null'],
          description: 'Required for add_marker.',
        },
        label: {
          type: ['string', 'null'],
          description: 'Required for add_marker.',
        },
      },
      required: ['action', 'fileId', 'startSeconds', 'endSeconds', 'view', 'timeSeconds', 'label'],
      additionalProperties: false,
    },
  },
};

export const COMPARE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'compare',
    description: 'Compares two or more loaded files side-by-side. Returns level (peak, RMS, crest factor) and spectrum (peak frequency) for each file, plus all pairwise numeric diffs. Use when the user asks to compare files or asks which is louder/brighter/etc.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          description: 'IDs of the files to compare (minimum 2). Obtained from getState() loadedFiles.',
        },
        startSeconds: {
          type: ['number', 'null'],
          description: 'Start of the region to compare in seconds. Omit to compare full files.',
        },
        endSeconds: {
          type: ['number', 'null'],
          description: 'End of the region to compare in seconds. Omit to compare full files.',
        },
      },
      required: ['fileIds', 'startSeconds', 'endSeconds'],
      additionalProperties: false,
    },
  },
};

export const FIND_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'find',
    description: 'Searches a loaded audio file for specific event types and returns a timestamped list of occurrences. Use when the user asks about clipping, silence gaps, the loudest moment, or transient onsets.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the file to search. Obtained from getState() loadedFiles.',
        },
        kind: {
          type: 'string',
          enum: ['clipping', 'silence', 'loudest', 'transient', 'clicks'],
          description: 'clipping: finds samples at or near full scale. silence: finds gaps below -60 dBFS. loudest: finds the single loudest 500ms window. transient: finds sudden amplitude onsets. clicks: alias for transient-based click candidate detection.',
        },
        startSeconds: {
          type: ['number', 'null'],
          description: 'Start of the region to search in seconds. Omit to search the full file.',
        },
        endSeconds: {
          type: ['number', 'null'],
          description: 'End of the region to search in seconds. Omit to search the full file.',
        },
      },
      required: ['fileId', 'kind', 'startSeconds', 'endSeconds'],
      additionalProperties: false,
    },
  },
};

export const REPORT_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'report',
    description: 'Generates a structured Markdown report summarising all analysis results, findings, markers, and events collected during the current session. Call this when the user asks for a report, summary, or wants to export findings.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: ['string', 'null'],
          description: 'Optional title for the report. If omitted, a default title is used.',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
};

export const ALL_TOOL_SCHEMAS: OpenAiToolSchema[] = [
  GET_STATE_TOOL_SCHEMA,
  ANALYZE_TOOL_SCHEMA,
  COMPARE_TOOL_SCHEMA,
  FIND_TOOL_SCHEMA,
  WORKSPACE_TOOL_SCHEMA,
  REPORT_TOOL_SCHEMA,
];
