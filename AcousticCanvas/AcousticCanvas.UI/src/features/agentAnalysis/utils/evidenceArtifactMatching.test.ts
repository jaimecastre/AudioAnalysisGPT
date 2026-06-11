import { describe, expect, it } from 'vitest';
import { getEvidenceArtifactId } from './evidenceArtifactMatching';
import type { AgentArtifact } from '../agentWorkspaceSlice';
import type { AgentEvidenceItem } from './evidenceFormatting';

const findingsArtifactA: AgentArtifact = {
  type: 'findings_result',
  id: 'artifact-a',
  timestamp: '2026-06-10T12:00:00.000Z',
  fileId: 'file-a',
  findingCount: 1,
  ranAt: '2026-06-10T12:00:00.000Z',
  findings: [],
};

const findingsArtifactB: AgentArtifact = {
  type: 'findings_result',
  id: 'artifact-b',
  timestamp: '2026-06-10T12:00:00.000Z',
  fileId: 'file-b',
  findingCount: 1,
  ranAt: '2026-06-10T12:00:00.000Z',
  findings: [],
};

const spectrumArtifact: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrum-artifact',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrum',
  title: 'Spectrum',
  rows: [],
};

const spectrumArtifactA: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrum-artifact-a',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrum',
  title: 'Spectrum',
  fileId: 'file-a',
  rows: [],
};

const spectrumArtifactB: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrum-artifact-b',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrum',
  title: 'Spectrum',
  fileId: 'file-b',
  rows: [],
};

const spectrogramArtifact: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrogram-artifact',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrogram',
  title: 'Spectrogram',
  rows: [],
};

const cpbArtifactA: AgentArtifact = {
  type: 'tool_result',
  id: 'cpb-artifact-a',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_cpb',
  title: 'CPB',
  fileId: 'file-a',
  rows: [],
};

const cpbArtifactB: AgentArtifact = {
  type: 'tool_result',
  id: 'cpb-artifact-b',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_cpb',
  title: 'CPB',
  fileId: 'file-b',
  rows: [],
};

const soundQualityArtifactA: AgentArtifact = {
  type: 'tool_result',
  id: 'sq-artifact-a',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_sound_quality_metrics',
  title: 'Sound quality',
  fileId: 'file-a',
  rows: [],
};

const soundQualityArtifactB: AgentArtifact = {
  type: 'tool_result',
  id: 'sq-artifact-b',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_sound_quality_metrics',
  title: 'Sound quality',
  fileId: 'file-b',
  rows: [],
};

const spectrogramArtifactA: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrogram-artifact-a',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrogram',
  title: 'Spectrogram',
  fileId: 'file-a',
  rows: [],
};

const spectrogramArtifactB: AgentArtifact = {
  type: 'tool_result',
  id: 'spectrogram-artifact-b',
  timestamp: '2026-06-10T12:00:00.000Z',
  toolName: 'run_spectrogram',
  title: 'Spectrogram',
  fileId: 'file-b',
  rows: [],
};

describe('evidenceArtifactMatching', () => {
  it('matches findings evidence to the artifact for the same file', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_findings_file_b',
      type: 'findings',
      data: {
        fileId: 'file-b',
        fileName: 'sine_1000Hz.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [findingsArtifactA, findingsArtifactB]);

    expect(artifactId).toBe('artifact-b');
  });

  it('matches spectrum evidence to the spectrum tool result artifact', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_spectrum_file_a',
      type: 'spectrum',
      data: {
        fileId: 'file-a',
        fileName: 'Sine_500hz.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [spectrumArtifact]);

    expect(artifactId).toBe('spectrum-artifact');
  });

  it('matches spectrum evidence to the artifact for the same file when several spectra exist', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_spectrum_file_b',
      type: 'spectrum',
      data: {
        fileId: 'file-b',
        fileName: 'Sine_1000hz.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [spectrumArtifactA, spectrumArtifactB]);

    expect(artifactId).toBe('spectrum-artifact-b');
  });

  it('matches spectrogram evidence to the spectrogram tool result artifact', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_spectrogram_file_a',
      type: 'spectrogram',
      data: {
        fileId: 'file-a',
        fileName: 'Sine_500hz.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [spectrogramArtifact]);

    expect(artifactId).toBe('spectrogram-artifact');
  });

  it('matches spectrogram evidence to the artifact for the same file when several spectrograms exist', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_spectrogram_file_b',
      type: 'spectrogram',
      data: {
        fileId: 'file-b',
        fileName: 'Sine_1000hz.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [spectrogramArtifactA, spectrogramArtifactB]);

    expect(artifactId).toBe('spectrogram-artifact-b');
  });

  it('matches CPB evidence to the artifact for the same file when several CPB artifacts exist', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_cpb_file_b',
      type: 'cpb',
      data: {
        fileId: 'file-b',
        fileName: 'Noise_B.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [cpbArtifactA, cpbArtifactB]);

    expect(artifactId).toBe('cpb-artifact-b');
  });

  it('matches sound quality evidence to the artifact for the same file when several sound quality artifacts exist', () => {
    const evidenceItem: AgentEvidenceItem = {
      evidenceId: 'ev_sound_quality_file_b',
      type: 'sound_quality',
      data: {
        fileId: 'file-b',
        fileName: 'Rough_B.wav',
      },
    };

    const artifactId = getEvidenceArtifactId(evidenceItem, [soundQualityArtifactA, soundQualityArtifactB]);

    expect(artifactId).toBe('sq-artifact-b');
  });
});
