import { describe, expect, it } from 'vitest';
import { canRunBenchmarkWithSelection } from './benchmarkSelection';

describe('benchmarkSelection', () => {
  it('requires at least two files in the modal selection', () => {
    expect(canRunBenchmarkWithSelection(new Set<string>())).toBe(false);
    expect(canRunBenchmarkWithSelection(new Set<string>(['file-a']))).toBe(false);
    expect(canRunBenchmarkWithSelection(new Set<string>(['file-a', 'file-b']))).toBe(true);
  });
});
