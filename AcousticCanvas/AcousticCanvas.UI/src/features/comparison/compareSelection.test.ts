import { describe, expect, it } from 'vitest';
import { canRunCompare, clampCompareSelection, toggleCompareSelection } from './compareSelection';

describe('compareSelection', () => {
  it('does not allow selecting more than two files', () => {
    let selection = new Set<string>();

    selection = toggleCompareSelection(selection, 'file-a');
    selection = toggleCompareSelection(selection, 'file-b');
    selection = toggleCompareSelection(selection, 'file-c');

    expect([...selection]).toEqual(['file-a', 'file-b']);
  });

  it('allows replacing a selected file only after deselecting one first', () => {
    let selection = new Set<string>(['file-a', 'file-b']);

    selection = toggleCompareSelection(selection, 'file-a');
    selection = toggleCompareSelection(selection, 'file-c');

    expect([...selection]).toEqual(['file-b', 'file-c']);
  });

  it('requires exactly two files to run compare', () => {
    expect(canRunCompare(new Set<string>())).toBe(false);
    expect(canRunCompare(new Set<string>(['file-a']))).toBe(false);
    expect(canRunCompare(new Set<string>(['file-a', 'file-b']))).toBe(true);
  });

  it('clamps larger initial selection to two files', () => {
    const clamped = clampCompareSelection(new Set<string>(['file-a', 'file-b', 'file-c']));
    expect([...clamped]).toEqual(['file-a', 'file-b']);
  });
});
