import { useCallback, useState } from 'react';
import { canRunBenchmarkWithSelection } from '../utils/benchmarkSelection';

interface IUseBenchmarkSelectionReturn {
  selectedIds: Set<string>;
  toggleSelection: (fileId: string) => void;
  selectAll: (fileIds: string[]) => void;
  clearSelection: () => void;
  canRun: boolean;
  selectedCount: number;
}

export function useBenchmarkSelection(
  initialSelectedIds: Set<string> = new Set(),
): IUseBenchmarkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );

  const toggleSelection = useCallback((fileId: string): void => {
    setSelectedIds((previousSelection) => {
      const nextSelection = new Set(previousSelection);
      if (nextSelection.has(fileId)) {
        nextSelection.delete(fileId);
      } else {
        nextSelection.add(fileId);
      }
      return nextSelection;
    });
  }, []);

  const selectAll = useCallback((fileIds: string[]): void => {
    setSelectedIds(new Set(fileIds));
  }, []);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const canRun = canRunBenchmarkWithSelection(selectedIds);
  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    canRun,
    selectedCount,
  };
}
