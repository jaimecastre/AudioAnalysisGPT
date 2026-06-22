import type { ChatMessage } from '../store/chatSlice';
import type {
  AgentResponseBlock,
  WorkflowBlock,
  StatisticsBlock,
  RankingBlock,
  SuggestedActionsBlock,
  SpectrumOverlayBlock,
  InvestigationBlock,
  SoundQualityComparisonBlock,
  AnalysisViewBlock,
} from '../services/agentAskService';

export type InvestigationReportOptions = {
  title: string;
  userQuestion?: string;
};

export function buildInvestigationReportMarkdown(
  message: ChatMessage,
  options: InvestigationReportOptions,
): string {
  const sections: string[] = [];

  const title = options.title.trim().length > 0 ? options.title.trim() : 'Acoustic Investigation Report';
  const generatedAt = formatGeneratedAt(message.timestamp);

  sections.push(`# ${title}\n\n_Generated: ${generatedAt}_`);

  if (options.userQuestion) {
    sections.push(`**Question:** ${options.userQuestion}`);
  }

  if (message.content.trim().length > 0) {
    sections.push(message.content.trim());
  }

  for (const block of message.blocks ?? []) {
    const rendered = renderBlock(block);
    if (rendered) sections.push(rendered);
  }

  if ((message.overlayBlocks?.length ?? 0) > 0) {
    sections.push(renderOverlayBlocks(message.overlayBlocks!));
  }

  if ((message.investigationBlocks?.length ?? 0) > 0) {
    sections.push(renderInvestigationBlocks(message.investigationBlocks!));
  }

  if ((message.soundQualityComparisonBlocks?.length ?? 0) > 0) {
    sections.push(renderSoundQualityBlocks(message.soundQualityComparisonBlocks!));
  }

  const completedSteps = (message.toolSteps ?? []).filter((s) => s.status === 'completed');
  if (completedSteps.length > 0) {
    const items = completedSteps.map((s) => `- ${s.toolName}`).join('\n');
    sections.push(`## Analysis Methods\n\n${items}`);
  }

  if (message.confidence) {
    sections.push(`**Confidence:** ${message.confidence}`);
  }

  if ((message.limitations?.length ?? 0) > 0) {
    const items = message.limitations!.map((l) => `- ${l}`).join('\n');
    sections.push(`## Limitations\n\n${items}`);
  }

  return sections.join('\n\n');
}

function renderBlock(block: AgentResponseBlock): string | null {
  switch (block.blockType) {
    case 'workflow':
      return renderWorkflowBlock(block);
    case 'statistics':
      return renderStatisticsBlock(block);
    case 'ranking':
      return renderRankingBlock(block);
    case 'suggestedActions':
      return renderSuggestedActionsBlock(block);
    case 'analysisView':
      return renderAnalysisViewBlock(block);
    case 'markdown':
      return block.content.trim().length > 0 ? block.content.trim() : null;
    case 'spectrumChart':
      return block.peakFrequencyHz != null
        ? `_Spectrum: ${block.fileName} — peak at ${block.peakFrequencyHz} Hz_`
        : `_Spectrum: ${block.fileName}_`;
    // spectrumOverlay, investigation, soundQualityComparison are in separate arrays on ChatMessage
    default:
      return null;
  }
}

function renderWorkflowBlock(block: WorkflowBlock): string {
  const steps = block.steps
    .map((s) => `${s.stepNumber}. ${s.toolName} — ${s.description} (${s.fileName})`)
    .join('\n');
  return `## Investigation Workflow\n\n${steps}`;
}

function renderStatisticsBlock(block: StatisticsBlock): string {
  const header = '| Metric | Value |\n|--------|-------|';
  const rows = block.rows
    .map((r) => `| ${r.label} | ${r.value}${r.unit ? ` ${r.unit}` : ''} |`)
    .join('\n');
  return `## ${block.title}\n\n${header}\n${rows}`;
}

function renderRankingBlock(block: RankingBlock): string {
  const items = block.rankedItems
    .map((item) => `${item.rank}. ${item.fileName} — ${item.scoreLabel}${item.scoreUnit ? ` ${item.scoreUnit}` : ''}`)
    .join('\n');
  return `## ${block.title}\n\n${items}`;
}

function renderSuggestedActionsBlock(block: SuggestedActionsBlock): string {
  const items = block.actions.map((a) => `- ${a.label}`).join('\n');
  return `## Suggested Next Steps\n\n${items}`;
}

function renderAnalysisViewBlock(block: AnalysisViewBlock): string {
  return `_${capitalize(block.viewType)} analysis: ${block.fileName}_`;
}

function renderOverlayBlocks(blocks: SpectrumOverlayBlock[]): string {
  const header = '| File | Focus Frequency | Annotation |\n|------|----------------|------------|';
  const rows = blocks.flatMap((b) =>
    b.signals.map((s) => {
      const freq = s.plotHints?.focusFrequencyHz != null ? `${s.plotHints.focusFrequencyHz} Hz` : '—';
      const label = s.plotHints?.annotationLabel ?? '—';
      return `| ${s.fileName} | ${freq} | ${label} |`;
    }),
  );
  return `## Spectrum Comparison\n\n${header}\n${rows.join('\n')}`;
}

function renderInvestigationBlocks(blocks: InvestigationBlock[]): string {
  const header = '| File | Analysis Type | Focus Frequency |\n|------|--------------|----------------|';
  const rows = blocks.flatMap((b) =>
    b.signals.map((s) => {
      const freq = s.plotHints?.focusFrequencyHz != null ? `${s.plotHints.focusFrequencyHz} Hz` : '—';
      return `| ${s.fileName} | ${s.viewType} | ${freq} |`;
    }),
  );
  return `## Multi-Signal Investigation\n\n${header}\n${rows.join('\n')}`;
}

function renderSoundQualityBlocks(blocks: SoundQualityComparisonBlock[]): string {
  const header =
    '| File | Loudness (sone) | Sharpness (acum) | Roughness (asper) |\n' +
    '|------|----------------|-----------------|-------------------|';
  const rows = blocks.flatMap((b) =>
    b.signals.map(
      (s) => `| ${s.fileName} | ${s.loudnessSone} | ${s.sharpnessAcum} | ${s.roughnessAsper} |`,
    ),
  );
  return `## Sound Quality Comparison\n\n${header}\n${rows.join('\n')}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatGeneratedAt(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'unavailable';
  return parsed.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
