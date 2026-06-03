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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5146';
const BACKEND_CHAT_ENDPOINT = `${API_BASE_URL}/api/agent/chat`;

export async function callOpenAiChat(
  _apiKey: string,
  request: OpenAiChatRequest,
): Promise<OpenAiChatResponse> {
  const response = await fetch(BACKEND_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.tool_choice ?? 'auto',
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Agent API error ${response.status}: ${errorBody}`);
  }

  const data: OpenAiChatResponse = await response.json();
  return data;
}
