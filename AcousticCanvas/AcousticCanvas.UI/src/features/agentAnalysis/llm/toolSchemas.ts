export type OpenAiToolSchema = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const GET_STATE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'getState',
    description: 'Returns a snapshot of the current workspace: active file metadata, active time selection, visible views, and available analysis capabilities. Always call this first before running any analysis.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export const ANALYZE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'analyze',
    description: 'Runs a named analysis on the active file or a selected region and returns measured results. Supported kinds: file_info (metadata), level (peak, RMS, crest factor, DC offset), spectrum (FFT frequency content).',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['file_info', 'level', 'spectrum'],
          description: 'The type of analysis to run.',
        },
        fileId: {
          type: 'string',
          description: 'The ID of the file to analyse. Obtained from getState().',
        },
        startSeconds: {
          type: 'number',
          description: 'Start of the region to analyse in seconds. Omit to analyse the full file.',
        },
        endSeconds: {
          type: 'number',
          description: 'End of the region to analyse in seconds. Omit to analyse the full file.',
        },
      },
      required: ['kind', 'fileId'],
    },
  },
};

export const WORKSPACE_TOOL_SCHEMA: OpenAiToolSchema = {
  type: 'function',
  function: {
    name: 'workspace',
    description: 'Updates the workspace state. Use to add markers, set a time selection, open or close views, or change the active file.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_active_file', 'set_selection', 'open_view', 'close_view', 'add_marker', 'set_loop_region'],
          description: 'The workspace action to perform.',
        },
        fileId: {
          type: 'string',
          description: 'Required for set_active_file and add_marker.',
        },
        startSeconds: {
          type: 'number',
          description: 'Required for set_selection and set_loop_region.',
        },
        endSeconds: {
          type: 'number',
          description: 'Required for set_selection and set_loop_region.',
        },
        view: {
          type: 'string',
          enum: ['waveform', 'spectrogram', 'spectrum'],
          description: 'Required for open_view and close_view.',
        },
        timeSeconds: {
          type: 'number',
          description: 'Required for add_marker.',
        },
        label: {
          type: 'string',
          description: 'Required for add_marker.',
        },
      },
      required: ['action'],
    },
  },
};

export const ALL_TOOL_SCHEMAS: OpenAiToolSchema[] = [
  GET_STATE_TOOL_SCHEMA,
  ANALYZE_TOOL_SCHEMA,
  WORKSPACE_TOOL_SCHEMA,
];
