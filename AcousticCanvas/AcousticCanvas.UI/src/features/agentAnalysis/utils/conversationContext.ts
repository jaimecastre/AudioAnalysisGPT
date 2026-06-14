import type { ChatMessage, ChatRole } from '../store/chatSlice';

export type AgentConversationTurn = {
  role: Extract<ChatRole, 'user' | 'assistant'>;
  content: string;
};

const MAX_CONTEXT_TURNS = 6;
const MAX_TURN_CHARACTERS = 1200;

export function buildRecentConversationContext(
  messages: ChatMessage[],
  currentUserContent: string,
): AgentConversationTurn[] {
  const eligibleTurns: AgentConversationTurn[] = [];

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    if (message.role === 'assistant' && message.status !== 'completed') continue;

    const content = normalizeTurnContent(message.content);
    if (content.length === 0) continue;

    eligibleTurns.push({ role: message.role, content });
  }

  const currentContent = normalizeTurnContent(currentUserContent);
  if (currentContent.length > 0) {
    eligibleTurns.push({ role: 'user', content: currentContent });
  }

  return eligibleTurns.slice(-MAX_CONTEXT_TURNS);
}

function normalizeTurnContent(content: string): string {
  const singleLineContent = content.replace(/\s+/g, ' ').trim();
  if (singleLineContent.length <= MAX_TURN_CHARACTERS) {
    return singleLineContent;
  }

  return `${singleLineContent.slice(0, MAX_TURN_CHARACTERS)}...`;
}
