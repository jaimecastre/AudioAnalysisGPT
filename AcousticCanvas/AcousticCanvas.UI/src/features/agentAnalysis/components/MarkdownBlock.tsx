import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import { Text } from '@mantine/core';

interface IMarkdownBlockProps {
  content: string;
}

export function MarkdownBlock({ content }: IMarkdownBlockProps): JSX.Element {
  return (
    <Text component="div" size="sm">
      <ReactMarkdown>{content}</ReactMarkdown>
    </Text>
  );
}
