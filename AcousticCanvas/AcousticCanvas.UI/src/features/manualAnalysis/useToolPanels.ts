import { useState } from 'react';

interface ToolPanel {
  id: string;
  type: 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
  fileId: string | null;
}

interface UseToolPanelsReturn {
  toolPanels: ToolPanel[];
  hasSpectrogramPanel: boolean;
  hasSpectrumPanel: boolean;
  hasCpbPanel: boolean;
  hasSoundQualityPanel: boolean;
  handleAddSpectrogramPanel: (fileId: string | null) => void;
  handleAddSpectrumPanel: (fileId: string | null) => void;
  handleAddCpbPanel: (fileId: string | null) => void;
  handleAddSoundQualityPanel: (fileId: string | null) => void;
  handleToolPanelFileSelect: (panelId: string, fileId: string | null) => void;
  handleToolPanelClose: (panelId: string) => void;
}

export const useToolPanels = (): UseToolPanelsReturn => {
  const [toolPanels, setToolPanels] = useState<ToolPanel[]>([]);

  const hasSpectrogramPanel = toolPanels.some((panel) => panel.type === 'spectrogram');
  const hasSpectrumPanel = toolPanels.some((panel) => panel.type === 'spectrum');
  const hasCpbPanel = toolPanels.some((panel) => panel.type === 'cpb');
  const hasSoundQualityPanel = toolPanels.some((panel) => panel.type === 'soundQuality');

  const handleAddSpectrogramPanel = (fileId: string | null): void => {
    if (hasSpectrogramPanel) return;
    const newPanelId = `spectrogram-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrogram', fileId }]);
  };

  const handleAddSpectrumPanel = (fileId: string | null): void => {
    if (hasSpectrumPanel) return;
    const newPanelId = `spectrum-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'spectrum', fileId }]);
  };

  const handleAddCpbPanel = (fileId: string | null): void => {
    if (hasCpbPanel) return;
    const newPanelId = `cpb-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'cpb', fileId }]);
  };

  const handleAddSoundQualityPanel = (fileId: string | null): void => {
    if (hasSoundQualityPanel) return;
    const newPanelId = `sound-quality-${Date.now()}`;
    setToolPanels((prev) => [...prev, { id: newPanelId, type: 'soundQuality', fileId }]);
  };

  const handleToolPanelFileSelect = (panelId: string, fileId: string | null): void => {
    setToolPanels((prev) => prev.map((p) => p.id === panelId ? { ...p, fileId } : p));
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
    handleToolPanelClose,
  };
};
