import { useEffect, useState } from 'react';

type ToolPanelType = 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
type ToolPanelSpan = 'normal' | 'wide';

interface IToolPanel {
  id: string;
  type: ToolPanelType;
  fileId: string | null;
  span: ToolPanelSpan;
}

interface IUseToolPanelsReturn {
  toolPanels: IToolPanel[];
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
  hasCpbPanel: boolean;
  hasSoundQualityPanel: boolean;
  handleAddSpectrogramPanel: (fileId: string | null) => void;
  handleAddSpectrumPanel: (fileId: string | null) => void;
  handleAddCpbPanel: (fileId: string | null) => void;
  handleAddSoundQualityPanel: (fileId: string | null) => void;
  handleToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
  handleToolPanelToggleSpan: (panelId: string) => void;
  handleToolPanelClose: (panelId: string) => void;
}

const STORAGE_KEY = 'acousticcanvas.manualAnalysis.toolPanels';
const PANEL_TYPES: ToolPanelType[] = ['spectrogram', 'spectrum', 'cpb', 'soundQuality'];

// localStorage is a system boundary: the stored value may be absent, malformed,
// or written by an older version that lacked `span`. Normalize defensively and
// drop anything that doesn't fit the current shape.
function normalizePanel(value: unknown): IToolPanel[] {
  if (typeof value !== 'object' || value === null) return [];
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string') return [];
  if (!PANEL_TYPES.includes(candidate.type as ToolPanelType)) return [];
  const fileId = typeof candidate.fileId === 'string' ? candidate.fileId : null;
  const span: ToolPanelSpan = candidate.span === 'wide' ? 'wide' : 'normal';
  return [{ id: candidate.id, type: candidate.type as ToolPanelType, fileId, span }];
}

function loadPersistedPanels(): IToolPanel[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(normalizePanel);
  } catch {
    return [];
  }
}

export const useToolPanels = (): IUseToolPanelsReturn => {
  const [toolPanels, setToolPanels] = useState<IToolPanel[]>(loadPersistedPanels);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toolPanels));
    } catch {
      // Persistence is best-effort; ignore quota/security failures.
    }
  }, [toolPanels]);

  const hasSpectrogramPanel = toolPanels.some((panel) => panel.type === 'spectrogram');
  const hasSpectrumPanel = toolPanels.some((panel) => panel.type === 'spectrum');
  const hasCpbPanel = toolPanels.some((panel) => panel.type === 'cpb');
  const hasSoundQualityPanel = toolPanels.some((panel) => panel.type === 'soundQuality');

  const handleAddSpectrogramPanel = (fileId: string | null): void => {
    if (hasSpectrogramPanel) return;
    const newPanelId = `spectrogram-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrogram', fileId, span: 'normal' }]);
  };

  const handleAddSpectrumPanel = (fileId: string | null): void => {
    if (hasSpectrumPanel) return;
    const newPanelId = `spectrum-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrum', fileId, span: 'normal' }]);
  };

  const handleAddCpbPanel = (fileId: string | null): void => {
    if (hasCpbPanel) return;
    const newPanelId = `cpb-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'cpb', fileId, span: 'normal' }]);
  };

  const handleAddSoundQualityPanel = (fileId: string | null): void => {
    if (hasSoundQualityPanel) return;
    const newPanelId = `sound-quality-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'soundQuality', fileId, span: 'normal' }]);
  };

  const handleToolPanelFileSelect = (panelId: string, fileId: string | null): void => {
    setToolPanels((prev) => prev.map((p) => p.id === panelId ? { ...p, fileId } : p));
  };

  const handleToolPanelToggleSpan = (panelId: string): void => {
    setToolPanels((prev) => prev.map((p) =>
      p.id === panelId ? { ...p, span: p.span === 'wide' ? 'normal' : 'wide' } : p,
    ));
  };

  const handleToolPanelClose = (panelId: string): void => {
    setToolPanels((prev) => prev.filter((p) => p.id !== panelId));
  };

  return {
    toolPanels,
    hasSpectrogramPanel,
    hasSpectrumPanel,
    hasCpbPanel,
    hasSoundQualityPanel,
    handleAddSpectrogramPanel,
    handleAddSpectrumPanel,
    handleAddCpbPanel,
    handleAddSoundQualityPanel,
    handleToolPanelFileSelect,
    handleToolPanelToggleSpan,
    handleToolPanelClose,
  };
};
