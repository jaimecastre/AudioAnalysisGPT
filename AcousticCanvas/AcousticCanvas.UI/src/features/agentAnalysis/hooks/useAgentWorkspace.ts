import { useAppSelector } from '../../../store/reduxHooks';
import { projectFilesSelector } from '../../project/projectSlice';
import { useResizableSidebar } from '../../../shared/useResizableSidebar';

export function useAgentWorkspace() {
  const files = useAppSelector(projectFilesSelector);
  const hasNoFile = files.length === 0;
  const { handleResizePointerDown, containerRef } = useResizableSidebar({ initialWidth: 320, minWidth: 260, maxWidth: 540 });

  return { hasNoFile, handleResizePointerDown, containerRef };
}
