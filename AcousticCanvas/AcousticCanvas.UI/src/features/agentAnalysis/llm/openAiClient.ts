import type { OpenAiToolSchema } from './toolSchemas';

export type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenAiChoice = {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAiToolCall[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
};

export type OpenAiChatResponse = {
  id: string;
  choices: OpenAiChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenAiChatRequest = {
  model?: string;
  messages: OpenAiMessage[];
  tools?: OpenAiToolSchema[];
  tool_choice?: 'auto' | 'none' | 'required';
  temperature?: number;
  max_tokens?: number;
};

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

export async function callOpenAiChat(
  apiKey: string,
  request: OpenAiChatRequest,
): Promise<OpenAiChatResponse> {
  const response = await fetch(OPENAI_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...request, model: OPENAI_MODEL }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const data: OpenAiChatResponse = await response.json();
  return data;
}
