const AUDIO_MIME_TYPES = ['audio/wav', 'audio/mpeg', 'audio/flac', 'audio/aiff', 'audio/x-aiff', 'audio/ogg'];
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg'];
const TEXT_MIME_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'application/json'];
const TEXT_EXTENSIONS = ['.pdf', '.txt', '.md', '.json'];

export const ATTACH_ACCEPT = '.wav,.mp3,.flac,.aiff,.aif,.ogg,.pdf,.txt,.md,.json';

export type PendingAttachment =
  | { kind: 'audio'; file: File; name: string }
  | { kind: 'text'; file: File; name: string; content: string };

export function isAudioFile(file: File): boolean {
  const mimeMatch = AUDIO_MIME_TYPES.includes(file.type);
  const extMatch = AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  return mimeMatch || extMatch;
}

export function isTextFile(file: File): boolean {
  const mimeMatch = TEXT_MIME_TYPES.some((mime) => file.type.startsWith(mime));
  const extMatch = TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  return mimeMatch || extMatch;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event): void => {
      const result = event.target?.result;
      resolve(typeof result === 'string' ? result : '');
    };
    reader.onerror = (): void => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function buildMessageWithAttachments(
  userText: string,
  pendingAttachments: PendingAttachment[],
): string {
  const textAttachments = pendingAttachments.filter((a) => a.kind === 'text') as Extract<PendingAttachment, { kind: 'text' }>[];
  const audioAttachments = pendingAttachments.filter((a) => a.kind === 'audio');

  const parts: string[] = [];

  if (audioAttachments.length > 0) {
    const audioNames = audioAttachments.map((a) => `"${a.name}"`).join(', ');
    parts.push(`[Audio file(s) loaded into workspace: ${audioNames}. Use getState() to see them and analyze() to inspect them.]`);
  }

  for (const attachment of textAttachments) {
    parts.push(`[Attached file: ${attachment.name}]\n${attachment.content}\n[End of ${attachment.name}]`);
  }

  parts.push(userText);
  return parts.join('\n\n');
}
