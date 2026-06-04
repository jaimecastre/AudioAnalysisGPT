/**
 * Determines whether a user message should be routed to the backend
 * AgentOrchestrator (POST /api/agent/ask) or handled by the existing
 * client-side LLM tool loop.
 *
 * Route to orchestrator when the user is asking an INVESTIGATIVE question
 * that requires the AI to plan, run DSP analysis, and explain evidence.
 *
 * Keep in the tool loop for WORKSPACE ACTIONS (add marker, set selection,
 * clear, report) where the agent mutates the local workspace state.
 */

const WORKSPACE_ACTION_KEYWORDS = [
  'add marker',
  'mark this',
  'pin this',
  'set selection',
  'set region',
  'select region',
  'loop region',
  'clear',
  'generate report',
  'create report',
  'make report',
];

const INVESTIGATIVE_KEYWORDS = [
  'clipping',
  'clipped',
  'distortion',
  'distorted',
  'overload',
  'silence',
  'silent',
  'quiet gap',
  'loudest',
  'transient',
  'click',
  'pops',
  'peak',
  'true peak',
  'rms',
  'crest',
  'dynamic range',
  'spectrum',
  'fft',
  'frequency',
  'spectral',
  'harsh',
  'muddy',
  'sibilance',
  'boomy',
  'boxy',
  'dull',
  'piercing',
  'congested',
  'low-mid',
  'low mid',
  'loudness',
  'lufs',
  'compare',
  'comparison',
  'versus',
  'difference',
  'analyse',
  'analyze',
  'analysis',
  'check',
  'inspect',
  'is there',
  'are there',
  'how loud',
  'what is the',
  'tell me',
  'show me',
  'describe',
  'summarize',
  'summary',
  'metadata',
  'sample rate',
  'bit depth',
  'duration',
  'channels',
  'file info',
  'format',
];

function includesAny(text: string, keywords: string[]): boolean {
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  return false;
}

export type QuestionRoute = 'orchestrator' | 'tool_loop';

export function routeUserQuestion(userText: string): QuestionRoute {
  const normalizedText = userText.trim().toLowerCase();

  if (normalizedText.length === 0) {
    return 'tool_loop';
  }

  const isWorkspaceAction = includesAny(normalizedText, WORKSPACE_ACTION_KEYWORDS);
  if (isWorkspaceAction) {
    return 'tool_loop';
  }

  const isInvestigativeQuestion = includesAny(normalizedText, INVESTIGATIVE_KEYWORDS);
  if (isInvestigativeQuestion) {
    return 'orchestrator';
  }

  return 'tool_loop';
}
