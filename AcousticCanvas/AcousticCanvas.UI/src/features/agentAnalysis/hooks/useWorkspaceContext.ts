import { useAppSelector } from '../../../store/reduxHooks';
import { activeSelectionSelector } from '../../waveform/store/waveformSelectionSlice';
import { projectFilesSelector, selectedSignalIdSelector } from '../../project/store/projectSlice';
import { chatMessagesSelector } from '../store/chatSlice';
import type { ChatMessage } from '../store/chatSlice';

function getLastCompletedAssistantMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === 'assistant' && message.status === 'completed') {
      return message;
    }
  }

  return null;
}

export function useWorkspaceContext() {
  const files = useAppSelector(projectFilesSelector);
  const selectedSignalId = useAppSelector(selectedSignalIdSelector);
  const activeSelection = useAppSelector(activeSelectionSelector);
  const messages = useAppSelector(chatMessagesSelector);

  const activeFile = files.find((file) => file.id === selectedSignalId) ?? null;
  const lastAssistantMessage = getLastCompletedAssistantMessage(messages);
  const plannedTools = lastAssistantMessage?.plannedTools ?? [];
  const limitations = lastAssistantMessage?.limitations ?? [];
  const hasValidationWarning = lastAssistantMessage?.validationWarning === true;
  const hasValidSelection = activeSelection !== null && activeSelection.endSeconds > activeSelection.startSeconds;

  return {
    files,
    activeFile,
    activeSelection,
    plannedTools,
    limitations,
    hasValidationWarning,
    hasValidSelection,
  };
}
