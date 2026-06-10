export const MAX_COMPARE_SELECTION = 2;

export function clampCompareSelection(selection: Set<string>): Set<string> {
  const clampedSelection = new Set<string>();

  for (const fileId of selection) {
    if (clampedSelection.size >= MAX_COMPARE_SELECTION) {
      break;
    }
    clampedSelection.add(fileId);
  }

  return clampedSelection;
}

export function toggleCompareSelection(currentSelection: Set<string>, fileId: string): Set<string> {
  const nextSelection = clampCompareSelection(currentSelection);

  if (nextSelection.has(fileId)) {
    nextSelection.delete(fileId);
    return nextSelection;
  }

  if (nextSelection.size >= MAX_COMPARE_SELECTION) {
    return nextSelection;
  }

  nextSelection.add(fileId);
  return nextSelection;
}

export function canRunCompare(selection: Set<string>): boolean {
  return selection.size === MAX_COMPARE_SELECTION;
}
