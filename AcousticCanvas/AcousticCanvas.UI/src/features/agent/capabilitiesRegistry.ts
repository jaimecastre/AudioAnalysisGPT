import type { AgentCapability } from './agentToolTypes';

export const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    tool: 'getState',
    description: 'Returns a snapshot of the current workspace: active file, selection, visible views, and available tools.',
  },
  {
    tool: 'analyze',
    description: 'Runs a named analysis (e.g. level, spectrum, spectrogram) on the active file or a selected region and returns the result.',
  },
  {
    tool: 'compare',
    description: 'Compares analysis results from two files or two regions and returns a structured diff.',
  },
  {
    tool: 'find',
    description: 'Searches the audio for events such as clipping, silence, loudest region, or click artifacts.',
  },
  {
    tool: 'workspace',
    description: 'Updates the workspace: adds markers, opens or closes views, or sets the active selection.',
  },
  {
    tool: 'report',
    description: 'Generates a markdown report summarising all analysis results and findings in the current session.',
  },
];
