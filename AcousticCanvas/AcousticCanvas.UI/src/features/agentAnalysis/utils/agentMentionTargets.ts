type MentionableFile = {
  id: string;
  name: string;
};

export function resolveMentionsInText(text: string, resolvedMentions: Map<string, string>): string {
  return text.replace(/@([\w.-]+)/g, (match, fileName: string) => {
    const fileId = resolvedMentions.get(fileName);
    if (!fileId) return match;
    return `@${fileName} [fileId:${fileId}]`;
  });
}

export function getMentionedFileIdsFromMessage(
  message: string,
  projectFiles: MentionableFile[],
): string[] {
  const mentionedIds = new Set<string>();
  const hiddenFileIdRegex = /\[fileId:([^\]]+)\]/g;

  for (const match of message.matchAll(hiddenFileIdRegex)) {
    const fileId = match[1]?.trim();
    if (fileId) {
      mentionedIds.add(fileId);
    }
  }

  for (const file of projectFiles) {
    if (message.includes(`@${file.name}`)) {
      mentionedIds.add(file.id);
    }
  }

  return projectFiles
    .map((file) => file.id)
    .filter((fileId) => mentionedIds.has(fileId));
}
