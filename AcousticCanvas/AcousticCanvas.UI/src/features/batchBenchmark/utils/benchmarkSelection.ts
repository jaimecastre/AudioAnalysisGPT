export function canRunBenchmarkWithSelection(selection: Set<string>): boolean {
  return selection.size >= 2;
}
