import { describe, it, expect } from 'vitest';
import { RadarChartBlockView } from '../components/RadarChartBlockView';
import type { RadarChartBlock } from '../services/agentAskService';

describe('RadarChartBlockView', () => {
  it('exports a component function', () => {
    expect(typeof RadarChartBlockView).toBe('function');
  });

  it('accepts a RadarChartBlock with signals type contract', () => {
    const block: RadarChartBlock = {
      blockType: 'radarChart',
      title: 'Psychoacoustic Profile',
      signals: [
        { fileId: 'f1', fileName: 'a.wav', loudnessSone: 20, sharpnessAcum: 1.5, roughnessAsper: 0.02 },
        { fileId: 'f2', fileName: 'b.wav', loudnessSone: 15, sharpnessAcum: 1.7, roughnessAsper: 0.03 },
      ],
    };
    // type-level: verify the block satisfies the RadarChartBlock contract
    expect(block.blockType).toBe('radarChart');
    expect(block.signals).toHaveLength(2);
  });
});

