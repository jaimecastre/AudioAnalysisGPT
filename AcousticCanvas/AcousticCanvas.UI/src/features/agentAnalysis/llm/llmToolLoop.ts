import type { AppDispatch, RootState } from '../../../store/reduxStore';
import { callOpenAiChat } from './openAiClient';
import type { OpenAiMessage } from './openAiClient';
import { ALL_TOOL_SCHEMAS } from './toolSchemas';
import { SYSTEM_PROMPT } from './systemPrompt';
import { executeToolCall } from './toolExecutor';
import {
  toolCallStarted,
  toolCallFinished,
  assistantMessageReceived,
} from '../chatSlice';

const MAX_TOOL_ITERATIONS = 5;

export async function runLlmToolLoop(
  userText: string,
  dispatch: AppDispatch,
  getState: () => RootState,
  apiKey: string,
): Promise<void> {
  const conversationMessages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ];

  let iterationCount = 0;

  while (iterationCount < MAX_TOOL_ITERATIONS) {
    iterationCount += 1;

    let llmResponse;
    try {
      llmResponse = await callOpenAiChat(apiKey, {
        messages: conversationMessages,
        tools: ALL_TOOL_SCHEMAS,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1024,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch(assistantMessageReceived({
        id: crypto.randomUUID(),
        content: `Failed to reach the OpenAI API: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    const choice = llmResponse.choices[0];
    if (!choice) {
      dispatch(assistantMessageReceived({
        id: crypto.randomUUID(),
        content: 'The agent returned an empty response. Please try again.',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    const assistantMessage = choice.message;

    if (choice.finish_reason === 'stop' || !assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const finalContent = assistantMessage.content ?? 'Analysis complete.';
      dispatch(assistantMessageReceived({
        id: crypto.randomUUID(),
        content: finalContent,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    conversationMessages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const toolCallChatId = crypto.randomUUID();
      const toolDisplayName = `${toolCall.function.name}()`;

      dispatch(toolCallStarted({
        id: toolCallChatId,
        toolName: toolDisplayName,
        content: `Calling ${toolDisplayName}…`,
        timestamp: new Date().toISOString(),
      }));

      const currentState = getState();
      const executionResult = await executeToolCall(toolCall, dispatch, currentState);

      const resultParsed = JSON.parse(executionResult.resultJson) as Record<string, unknown>;
      const hasError = 'error' in resultParsed;

      dispatch(toolCallFinished({
        id: toolCallChatId,
        toolStatus: hasError ? 'error' : 'done',
        content: hasError
          ? `${toolDisplayName} → error: ${String(resultParsed['error'])}`
          : `${toolDisplayName} → done`,
      }));

      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: executionResult.resultJson,
      });
    }
  }

  dispatch(assistantMessageReceived({
    id: crypto.randomUUID(),
    content: 'The agent reached the maximum number of steps. Please try a more specific question.',
    timestamp: new Date().toISOString(),
  }));
}
