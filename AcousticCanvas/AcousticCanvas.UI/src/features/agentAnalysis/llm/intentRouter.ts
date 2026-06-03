export type RoutedToolHint =
  | {
      toolName: 'analyze';
      args: {
        kind: 'file_info' | 'loudness' | 'peaks' | 'dynamics' | 'spectral_balance' | 'noise' | 'stereo_phase' | 'distortion' | 'dialogue_clarity';
        focus?: 'general' | 'muddy' | 'boomy' | 'boxy' | 'harsh' | 'sibilant' | 'thin' | 'dull';
      };
      confidence: 'high' | 'medium';
      reason: string;
    }
  | {
      toolName: 'find';
      args: { kind: 'clipping' | 'silence' | 'loudest' | 'transient' };
      confidence: 'high' | 'medium';
      reason: string;
    }
  | {
      toolName: 'compare';
      args: Record<string, never>;
      confidence: 'high' | 'medium';
      reason: string;
    }
  | {
      toolName: 'workspace';
      args: { action: 'add_marker' | 'set_selection' };
      confidence: 'high' | 'medium';
      reason: string;
    }
  | {
      toolName: 'getState';
      args: Record<string, never>;
      confidence: 'high' | 'medium';
      reason: string;
    }
  | {
      toolName: 'unknown';
      args: Record<string, never>;
      confidence: 'low';
      reason: string;
    };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
  return pattern.test(text);
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => matchesKeyword(text, keyword));
}

function hasImperativeNegation(text: string): boolean {
  const pattern = /\b(?:don't|do not|dont|never)\s+(?:please\s+)?(?:add|set|find|check|run|compare|show|open|close|select)\b/i;
  return pattern.test(text);
}

export function shouldForceNoToolResponse(userText: string): boolean {
  const normalized = userText.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return hasImperativeNegation(normalized);
}

export function routeIntent(userText: string): RoutedToolHint {
  const normalized = userText.trim().toLowerCase();

  if (!normalized) {
    return {
      toolName: 'unknown',
      args: {},
      confidence: 'low',
      reason: 'Empty input.',
    };
  }

  if (hasImperativeNegation(normalized)) {
    return {
      toolName: 'unknown',
      args: {},
      confidence: 'low',
      reason: 'Imperative negation detected; skipping deterministic routing.',
    };
  }

  if (includesAny(normalized, ['compare', 'comparison', 'versus', 'vs', 'difference', 'difference between', 'different between'])) {
    return {
      toolName: 'compare',
      args: {},
      confidence: 'high',
      reason: 'The prompt asks for cross-file comparison.',
    };
  }

  if (includesAny(normalized, ['add marker', 'marker', 'mark this', 'pin this', 'pin point'])) {
    return {
      toolName: 'workspace',
      args: { action: 'add_marker' },
      confidence: 'medium',
      reason: 'The prompt requests placing a marker.',
    };
  }

  if (includesAny(normalized, ['selection', 'set region', 'select region', 'loop region', 'set loop'])) {
    return {
      toolName: 'workspace',
      args: { action: 'set_selection' },
      confidence: 'medium',
      reason: 'The prompt requests a region/selection update.',
    };
  }

  if (includesAny(normalized, ['clipping', 'clipped', 'distortion', 'distorted', 'overload'])) {
    return {
      toolName: 'find',
      args: { kind: 'clipping' },
      confidence: 'medium',
      reason: 'The prompt asks for clipping/distortion events.',
    };
  }

  if (includesAny(normalized, ['silence', 'silent', 'quiet gap', 'pause gap'])) {
    return {
      toolName: 'find',
      args: { kind: 'silence' },
      confidence: 'medium',
      reason: 'The prompt asks for silence events.',
    };
  }

  if (includesAny(normalized, ['loudest', 'loudest part', 'loudest moment'])) {
    return {
      toolName: 'find',
      args: { kind: 'loudest' },
      confidence: 'medium',
      reason: 'The prompt asks for the loudest region.',
    };
  }

  if (includesAny(normalized, ['click', 'clicks', 'clicking', 'click artifact', 'pops'])) {
    return {
      toolName: 'find',
      args: { kind: 'transient' },
      confidence: 'high',
      reason: 'Click requests map to transient-based click candidate detection.',
    };
  }

  if (includesAny(normalized, ['spectrum', 'fft', 'frequency', 'spectral', 'harsh', 'muddy', 'sibilance', 'boomy', 'boxy', 'dull', 'piercing', 'congested', 'low-mid', 'low mid', 'overwhelming bass', 'bass is overwhelming'])) {
    const focus = includesAny(normalized, ['muddy', 'muddiness', 'congested', 'low-mid', 'low mid'])
      ? 'muddy'
      : includesAny(normalized, ['boomy', 'boominess', 'overwhelming bass', 'bass is overwhelming'])
        ? 'boomy'
        : includesAny(normalized, ['boxy', 'boxiness'])
          ? 'boxy'
          : includesAny(normalized, ['harsh', 'harshness', 'piercing'])
            ? 'harsh'
            : includesAny(normalized, ['sibilance', 'sibilant'])
              ? 'sibilant'
              : includesAny(normalized, ['thin', 'thinness'])
                ? 'thin'
                : includesAny(normalized, ['dull', 'dullness'])
                  ? 'dull'
                  : 'general';

    return {
      toolName: 'analyze',
      args: {
        kind: 'spectral_balance',
        focus,
      },
      confidence: 'medium',
      reason: 'The prompt asks about spectral content or tonal balance.',
    };
  }

  if (includesAny(normalized, ['loudness', 'too loud', 'peak', 'true peak', 'rms', 'crushed', 'dynamic range'])) {
    const semanticKind = includesAny(normalized, ['peak', 'true peak'])
      ? 'peaks'
      : includesAny(normalized, ['dynamic range', 'crushed'])
        ? 'dynamics'
        : 'loudness';

    return {
      toolName: 'analyze',
      args: { kind: semanticKind },
      confidence: 'medium',
      reason: 'The prompt asks about amplitude or dynamics metrics.',
    };
  }

  if (includesAny(normalized, ['metadata', 'file info', 'format', 'sample rate', 'duration', 'channels', 'bit depth', 'how long', 'length'])) {
    return {
      toolName: 'analyze',
      args: { kind: 'file_info' },
      confidence: 'high',
      reason: 'The prompt asks for file metadata.',
    };
  }

  if (includesAny(normalized, ['state', 'workspace', 'what is loaded', 'show loaded', 'what file is loaded'])) {
    return {
      toolName: 'getState',
      args: {},
      confidence: 'medium',
      reason: 'The prompt asks for current workspace state.',
    };
  }

  return {
    toolName: 'unknown',
    args: {},
    confidence: 'low',
    reason: 'No deterministic keyword rule matched.',
  };
}

export function buildDeterministicRoutingHint(userText: string): string | null {
  const routed = routeIntent(userText);
  if (routed.toolName === 'unknown') {
    return null;
  }

  const intro = routed.confidence === 'high'
    ? 'Deterministic routing hint (high confidence):'
    : 'Optional routing hint (medium confidence):';

  if (routed.toolName === 'analyze') {
    const focusText = routed.args.focus ? `, focus="${routed.args.focus}"` : '';
    return `${intro} this request likely maps to analyze(kind="${routed.args.kind}"${focusText}). Use getState() first to obtain fileId, then run the tool. You may override this hint if user intent differs.`;
  }

  if (routed.toolName === 'find') {
    return `${intro} this request likely maps to find(kind="${routed.args.kind}"). Use getState() first to obtain fileId, then run the tool. You may override this hint if user intent differs.`;
  }

  if (routed.toolName === 'workspace') {
    return `${intro} this request likely maps to workspace(action="${routed.args.action}"). You may override this hint if user intent differs.`;
  }

  if (routed.toolName === 'compare') {
    return `${intro} this request likely maps to compare(). Use getState() first to list candidate file IDs. You may override this hint if user intent differs.`;
  }

  return `${intro} this request likely maps to getState(). You may override this hint if user intent differs.`;
}
