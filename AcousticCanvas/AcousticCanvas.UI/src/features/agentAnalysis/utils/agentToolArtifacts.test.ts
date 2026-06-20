import { describe, expect, it } from 'vitest';
import { createReportArtifactDraft, createToolResultArtifactDrafts } from './agentToolArtifacts';

describe('createToolResultArtifactDrafts', () => {
  it('splits multi-file spectrogram output into one artifact draft per file', () => {
    const drafts = createToolResultArtifactDrafts('run_spectrogram', {
      results: [
        {
          fileId: 'file-a',
          region: { startSeconds: 0, endSeconds: 2.5 },
          parameters: { fftSize: 2048, scale: 'mel' },
          summary: { frameCount: 215, binCount: 1025, nyquistHz: 22050 },
        },
        {
          fileId: 'file-b',
          region: { startSeconds: 0, endSeconds: 1.6 },
          parameters: { fftSize: 2048, scale: 'mel' },
          summary: { frameCount: 135, binCount: 1025, nyquistHz: 22050 },
        },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_spectrogram',
      fileId: 'file-a',
      rows: [
        { label: 'region', value: '0.000s - 2.500s' },
        { label: 'scale', value: 'mel' },
        { label: 'FFT size', value: '2048' },
        { label: 'frames', value: '215' },
        { label: 'bins', value: '1025' },
        { label: 'Nyquist', value: '22050 Hz' },
      ],
    });
    expect(drafts[1]?.fileId).toBe('file-b');
  });

  it('keeps non-spectrogram tool output as a single artifact draft', () => {
    const drafts = createToolResultArtifactDrafts('run_basic_metrics', {
      results: [
        {
          fileId: 'file-a',
          metrics: {
            rmsDbFs: -18.25,
            peakDbFs: -3.5,
            crestFactorDb: 14.75,
          },
        },
      ],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_basic_metrics',
      rows: [
        { label: 'RMS', value: '-18.25 dB SPL' },
        { label: 'peak', value: '-3.50 dB SPL' },
        { label: 'crest factor', value: '14.75 dB SPL' },
      ],
    });
  });

  it('splits multi-file spectrum output into one artifact draft per file', () => {
    const drafts = createToolResultArtifactDrafts('run_spectrum', {
      results: [
        {
          fileId: 'file-a',
          summary: {
            peakFrequencyHz: 257,
            maxMagnitudeDb: -12.5,
          },
        },
        {
          fileId: 'file-b',
          summary: {
            peakFrequencyHz: 86,
            maxMagnitudeDb: -18.25,
          },
        },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_spectrum',
      fileId: 'file-a',
      rows: [
        { label: 'peak frequency', value: '257 Hz' },
        { label: 'max magnitude', value: '-12.50 dB SPL' },
      ],
    });
    expect(drafts[1]).toMatchObject({
      toolName: 'run_spectrum',
      fileId: 'file-b',
      rows: [
        { label: 'peak frequency', value: '86 Hz' },
        { label: 'max magnitude', value: '-18.25 dB SPL' },
      ],
    });
  });

  it('splits multi-file CPB output into one artifact draft per file', () => {
    const drafts = createToolResultArtifactDrafts('run_cpb', {
      results: [
        {
          fileId: 'file-a',
          bandMode: 'third_octave',
          weighting: 'Z',
          summary: {
            highestBands: [
              { label: '1k', levelDb: -12.5 },
            ],
          },
        },
        {
          fileId: 'file-b',
          bandMode: 'octave',
          weighting: 'A',
          summary: {
            highestBands: [
              { label: '500', levelDb: -18.25 },
            ],
          },
        },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_cpb',
      fileId: 'file-a',
      rows: [
        { label: 'band mode', value: 'third_octave' },
        { label: 'weighting', value: 'Z' },
        { label: '1k', value: '-12.50 dB SPL' },
      ],
    });
    expect(drafts[1]).toMatchObject({
      toolName: 'run_cpb',
      fileId: 'file-b',
      rows: [
        { label: 'band mode', value: 'octave' },
        { label: 'weighting', value: 'A' },
        { label: '500', value: '-18.25 dB SPL' },
      ],
    });
  });

  it('splits multi-file sound quality output into one artifact draft per file', () => {
    const drafts = createToolResultArtifactDrafts('run_sound_quality_metrics', {
      results: [
        {
          fileId: 'file-a',
          loudness: { value: 10.5, unit: 'sone' },
          sharpness: { value: 1.25, unit: 'acum' },
          roughness: { value: 0.75, unit: 'asper' },
        },
        {
          fileId: 'file-b',
          loudness: { value: 12.25, unit: 'sone' },
          sharpness: { value: 0.95, unit: 'acum' },
          roughness: { value: 0.04, unit: 'asper' },
        },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      toolName: 'run_sound_quality_metrics',
      fileId: 'file-a',
      rows: [
        { label: 'loudness', value: '10.500 sone' },
        { label: 'sharpness', value: '1.250 acum' },
        { label: 'roughness', value: '0.750 asper' },
      ],
    });
    expect(drafts[1]).toMatchObject({
      toolName: 'run_sound_quality_metrics',
      fileId: 'file-b',
      rows: [
        { label: 'loudness', value: '12.250 sone' },
        { label: 'sharpness', value: '0.950 acum' },
        { label: 'roughness', value: '0.040 asper' },
      ],
    });
  });
});

describe('createReportArtifactDraft', () => {
  it('converts generate_report output into a report artifact draft', () => {
    const draft = createReportArtifactDraft({
      title: 'Acoustic QA Report',
      markdownContent: '# Acoustic QA Report\n\nMeasured values only.',
    });

    expect(draft).toEqual({
      title: 'Acoustic QA Report',
      markdownContent: '# Acoustic QA Report\n\nMeasured values only.',
    });
  });

  it('returns null when report content is missing', () => {
    expect(createReportArtifactDraft({ title: 'Acoustic QA Report' })).toBeNull();
    expect(createReportArtifactDraft(null)).toBeNull();
  });
});
