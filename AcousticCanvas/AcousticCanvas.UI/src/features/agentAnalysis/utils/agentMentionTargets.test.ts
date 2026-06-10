import { describe, expect, it } from 'vitest';
import {
  getMentionedFileIdsFromMessage,
  resolveMentionsInText,
} from './agentMentionTargets';

const projectFiles = [
  { id: 'file-a', name: '98223-7-0-0.wav' },
  { id: 'file-b', name: '98223-7-1-0.wav' },
];

describe('agentMentionTargets', () => {
  it('resolves selected @mentions to hidden file IDs', () => {
    const resolvedMentions = new Map<string, string>([
      ['98223-7-0-0.wav', 'file-a'],
    ]);

    const text = resolveMentionsInText('Run spectrogram @98223-7-0-0.wav', resolvedMentions);

    expect(text).toBe('Run spectrogram @98223-7-0-0.wav [fileId:file-a]');
  });

  it('uses hidden file ID mentions as the agent target list', () => {
    const fileIds = getMentionedFileIdsFromMessage(
      'Run spectrogram @98223-7-0-0.wav [fileId:file-a]',
      projectFiles,
    );

    expect(fileIds).toEqual(['file-a']);
  });

  it('uses exact typed @file names as the agent target list even without dropdown metadata', () => {
    const fileIds = getMentionedFileIdsFromMessage(
      'Run spectrogram @98223-7-0-0.wav',
      projectFiles,
    );

    expect(fileIds).toEqual(['file-a']);
  });

  it('returns no mention targets when the message references no file', () => {
    const fileIds = getMentionedFileIdsFromMessage('Run spectrogram', projectFiles);

    expect(fileIds).toEqual([]);
  });
});
