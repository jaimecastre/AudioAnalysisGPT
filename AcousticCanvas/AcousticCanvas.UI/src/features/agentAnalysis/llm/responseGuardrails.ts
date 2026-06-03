const SUBJECTIVE_SPECTRAL_TERMS = [
  'boxy',
  'muddy',
  'congested',
  'harsh',
  'sibilant',
  'sibilance',
  'boomy',
  'piercing',
  'thin',
  'dull',
];

function hasSubjectiveSpectralLanguage(text: string): boolean {
  const lowered = text.toLowerCase();
  return SUBJECTIVE_SPECTRAL_TERMS.some((term) => lowered.includes(term));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function containsBandEvidence(summary: Record<string, unknown>): boolean {
  const keys = Object.keys(summary).map((key) => key.toLowerCase());
  return keys.some((key) =>
    key.includes('band')
    || key.includes('energy')
    || key.includes('range')
    || key.includes('mask')
    || key.includes('low_mid')
    || key.includes('lowmid')
    || key.includes('high_mid')
    || key.includes('mid_band')
    || key.includes('spectral_balance'),
  );
}

function extractSpectrumSummary(output: unknown): Record<string, unknown> | null {
  const record = asRecord(output);
  if (!record) return null;

  const kind = typeof record['kind'] === 'string' ? String(record['kind']).toLowerCase() : '';
  const parameters = asRecord(record['parameters']);
  const semanticKind = parameters && typeof parameters['semanticKind'] === 'string'
    ? String(parameters['semanticKind']).toLowerCase()
    : '';

  const looksSpectrumLike = kind === 'spectrum' || semanticKind === 'spectral_balance' || semanticKind === 'dialogue_clarity' || semanticKind === 'noise';
  if (!looksSpectrumLike) return null;

  return asRecord(record['summary']);
}

function buildMeasuredFactsFallback(toolOutputs: unknown[]): string {
  for (const output of toolOutputs) {
    const summary = extractSpectrumSummary(output);
    if (!summary) continue;

    const entries = Object.entries(summary);
    const peakFrequencyEntry = entries.find(([key, value]) =>
      typeof value === 'number' && key.toLowerCase().includes('peakfrequency'),
    );
    const peakMagnitudeEntry = entries.find(([key, value]) =>
      typeof value === 'number' && (key.toLowerCase().includes('peakmagnitude') || key.toLowerCase().includes('magnitude')),
    );

    if (peakFrequencyEntry || peakMagnitudeEntry) {
      const facts: string[] = [];
      if (peakFrequencyEntry) {
        facts.push(`peak frequency ${Number(peakFrequencyEntry[1]).toFixed(2)} Hz`);
      }
      if (peakMagnitudeEntry) {
        facts.push(`peak magnitude ${Number(peakMagnitudeEntry[1]).toFixed(2)} dB`);
      }
      if (facts.length > 0) {
        return `Measured facts available from this run are ${facts.join(' and ')}.`;
      }
    }
  }

  return 'Measured facts are available, but this result does not include detailed band-energy evidence.';
}

export function applyGroundingGuardrails(assistantText: string, toolOutputs: unknown[]): string {
  if (!hasSubjectiveSpectralLanguage(assistantText)) {
    return assistantText;
  }

  const spectrumSummaries = toolOutputs
    .map(extractSpectrumSummary)
    .filter((summary): summary is Record<string, unknown> => summary !== null);

  if (spectrumSummaries.length === 0) {
    return assistantText;
  }

  const hasSufficientBandEvidence = spectrumSummaries.some((summary) => containsBandEvidence(summary));
  if (hasSufficientBandEvidence) {
    return assistantText;
  }

  const measuredFacts = buildMeasuredFactsFallback(toolOutputs);
  return `I can report measured spectral values, but I do not have enough band-energy evidence in this result to confirm subjective tonal labels like boxy, muddy, or harsh. ${measuredFacts} If you want, I can run a broader spectral-balance pass over a larger region for stronger evidence.`;
}
