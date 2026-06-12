import { useState } from 'react';

type ToolPanelType = 'spectrogram' | 'spectrum' | 'cpb' | 'soundQuality';
type ToolPanelSpan = 'normal' | 'wide';

interface ToolPanel {
  id: string;
  type: ToolPanelType;
  fileId: string | null;
  span: ToolPanelSpan;
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
  handleToolPanelToggleSpan: (panelId: string) => void;
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
