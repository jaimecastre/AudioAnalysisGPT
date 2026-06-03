import type { AppDispatch, RootState } from '../../../store/reduxStore';
import { callOpenAiChat } from './openAiClient';
import type { OpenAiMessage } from './openAiClient';
import { ALL_TOOL_SCHEMAS } from './toolSchemas';
import { SYSTEM_PROMPT } from './systemPrompt';
import { executeToolCall } from './toolExecutor';
import type { ArtifactReference } from './toolExecutor';
import { buildDeterministicRoutingHint, routeIntent, shouldForceNoToolResponse } from './intentRouter';
import { applyGroundingGuardrails } from './responseGuardrails';
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
  ];

  const routedIntent = routeIntent(userText);
  const routingHint = routedIntent.confidence === 'low' ? null : buildDeterministicRoutingHint(userText);
  if (routingHint) {
    conversationMessages.push({ role: 'system', content: routingHint });
  }

  conversationMessages.push({ role: 'user', content: userText });

  if (shouldForceNoToolResponse(userText)) {
    try {
      const noToolResponse = await callOpenAiChat(apiKey, {
        messages: conversationMessages,
        tools: ALL_TOOL_SCHEMAS,
        tool_choice: 'none',
        temperature: 0.2,
        max_tokens: 512,
      });

      const noToolChoice = noToolResponse.choices[0];
      const baseContent = noToolChoice?.message.content ?? 'Understood. I will not run that action.';
      const guardedContent = applyGroundingGuardrails(baseContent, []);
      dispatch(assistantMessageReceived({
        id: crypto.randomUUID(),
        content: guardedContent,
        timestamp: new Date().toISOString(),
      }));
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch(assistantMessageReceived({
        id: crypto.randomUUID(),
        content: `Failed to reach the OpenAI API: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      }));
      return;
    }
  }

  let iterationCount = 0;
  const turnArtifactRefs: ArtifactReference[] = [];
  const turnToolOutputs: unknown[] = [];

  const buildEvidenceSuffix = (): string => {
    if (turnArtifactRefs.length === 0) {
      return '';
    }

    const uniqueRefs = turnArtifactRefs.filter((ref, index, refs) =>
      refs.findIndex((candidate) => candidate.artifactId === ref.artifactId) === index,
    );

    if (uniqueRefs.length === 0) {
      return '';
    }

    const tokens = uniqueRefs.map((ref) => `[${ref.artifactType}:${ref.artifactId}]`);
    return `\n\n${tokens.join(', ')}`;
  };

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
      const baseContent = assistantMessage.content ?? 'Analysis complete.';
      const guardedContent = applyGroundingGuardrails(baseContent, turnToolOutputs);
      const finalContent = guardedContent + buildEvidenceSuffix();
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
      turnArtifactRefs.push(...executionResult.artifactRefs);

      const resultParsed = JSON.parse(executionResult.resultJson) as Record<string, unknown>;
      turnToolOutputs.push(resultParsed);
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
