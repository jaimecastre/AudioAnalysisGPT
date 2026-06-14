import type { JSX } from 'react';
import { useState } from 'react';
import { Stack, Divider, Text, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { AgentResponseBlock, SuggestedAction } from '../services/agentAskService';
import { MarkdownBlock } from './MarkdownBlock';
import { StatisticsBlock } from './StatisticsBlock';
import { SpectrumChartBlock } from './SpectrumChartBlock';
import { RankingBlock } from './RankingBlock';
import { SuggestedActionsBlock } from './SuggestedActionsBlock';
import { AnalysisViewBlock } from './AnalysisViewBlock';

interface IAgentResponseBlockRendererProps {
  blocks?: AgentResponseBlock[];
  answerText?: string;
  onActionClick?: (action: SuggestedAction) => void;
}

export function AgentResponseBlockRenderer({
  blocks,
  answerText,
  onActionClick,
}: IAgentResponseBlockRendererProps): JSX.Element | null {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  // Filter out markdown blocks that duplicate the answer text
  const filteredBlocks = blocks.filter((block) => {
    if (block.blockType !== 'markdown') return true;
    if (!answerText) return true;
    // Skip if markdown content is very similar to answer (first 50 chars match)
    const contentStart = block.content.slice(0, 50).toLowerCase();
    const answerStart = answerText.slice(0, 50).toLowerCase();
    return contentStart !== answerStart;
  });

  if (filteredBlocks.length === 0) {
    return null;
  }

  return (
    <Stack gap="md" mt="md">
      {filteredBlocks.map((block, index) => (
        <BlockErrorBoundary key={index} blockType={block.blockType}>
          <>
            {index > 0 && <Divider my="sm" />}
            {renderBlock(block, onActionClick)}
          </>
        </BlockErrorBoundary>
      ))}
    </Stack>
  );
}

interface IBlockErrorBoundaryProps {
  children: JSX.Element;
  blockType: string;
}

function BlockErrorBoundary({ children, blockType }: IBlockErrorBoundaryProps): JSX.Element {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Block Error" color="red" variant="light">
        <Text size="sm">
          Could not render {blockType} block. The data may be malformed or incomplete.
        </Text>
      </Alert>
    );
  }

  try {
    return children;
  } catch (error) {
    console.error(`[BlockErrorBoundary] Error rendering ${blockType} block:`, error);
    setHasError(true);
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Block Error" color="red" variant="light">
        <Text size="sm">
          Could not render {blockType} block. The data may be malformed or incomplete.
        </Text>
      </Alert>
    );
  }
}

function renderBlock(
  block: AgentResponseBlock,
  onActionClick?: (action: SuggestedAction) => void
): JSX.Element | null {
  switch (block.blockType) {
    case 'markdown':
      return <MarkdownBlock content={block.content} />;

    case 'statistics':
      return <StatisticsBlock title={block.title} rows={block.rows} />;

    case 'spectrumChart':
      return (
        <SpectrumChartBlock
          fileName={block.fileName}
          frequenciesHz={block.frequenciesHz}
          magnitudesDb={block.magnitudesDb}
          peakFrequencyHz={block.peakFrequencyHz}
          metadata={block.metadata}
        />
      );

    case 'ranking':
      return <RankingBlock title={block.title} rankedItems={block.rankedItems} />;

    case 'suggestedActions':
      return <SuggestedActionsBlock actions={block.actions} onActionClick={onActionClick} />;

    case 'analysisView':
      return <AnalysisViewBlock block={block} />;

    default:
      return null;
  }
}
