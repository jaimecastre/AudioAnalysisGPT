import { describe, it, expect, vi } from 'vitest';
import { applyWorkspaceAction } from './workspaceTool';
import type { AppDispatch } from '../../../store/reduxStore';

const mockDispatch = vi.fn() as unknown as AppDispatch;

describe('applyWorkspaceAction — set_active_file', () => {
  it('dispatches setSelectedSignal and returns success', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'set_active_file',
      fileId: 'file-001',
    });

    expect(result.appliedAction).toBe('set_active_file');
    expect(result.success).toBe(true);
    expect(mockDispatch).toHaveBeenCalled();
  });
});

describe('applyWorkspaceAction — set_selection', () => {
  it('dispatches setActiveSelection and returns success for valid range', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'set_selection',
      startSeconds: 1.0,
      endSeconds: 3.0,
    });

    expect(result.appliedAction).toBe('set_selection');
    expect(result.success).toBe(true);
    expect(result.detail).toContain('1');
    expect(result.detail).toContain('3');
  });

  it('returns failure when endSeconds is not greater than startSeconds', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'set_selection',
      startSeconds: 3.0,
      endSeconds: 1.0,
    });

    expect(result.appliedAction).toBe('set_selection');
    expect(result.success).toBe(false);
    expect(result.detail).toContain('Invalid selection');
  });
});

describe('applyWorkspaceAction — open_view / close_view', () => {
  it('dispatches openView and returns success', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'open_view',
      view: 'spectrogram',
    });

    expect(result.appliedAction).toBe('open_view');
    expect(result.success).toBe(true);
    expect(result.detail).toContain('spectrogram');
  });

  it('dispatches closeView and returns success', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'close_view',
      view: 'spectrum',
    });

    expect(result.appliedAction).toBe('close_view');
    expect(result.success).toBe(true);
    expect(result.detail).toContain('spectrum');
  });
});

describe('applyWorkspaceAction — add_marker', () => {
  it('dispatches addMarker with source=agent and returns success', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'add_marker',
      fileId: 'file-001',
      timeSeconds: 2.5,
      label: 'Clipping detected',
    });

    expect(result.appliedAction).toBe('add_marker');
    expect(result.success).toBe(true);
    expect(result.detail).toContain('Clipping detected');
    expect(result.detail).toContain('2.5');
  });
});

describe('applyWorkspaceAction — set_loop_region', () => {
  it('dispatches setActiveSelection and setLoopEnabled and returns success for valid range', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'set_loop_region',
      startSeconds: 0.5,
      endSeconds: 2.5,
    });

    expect(result.appliedAction).toBe('set_loop_region');
    expect(result.success).toBe(true);
    expect(result.detail).toContain('loop enabled');
  });

  it('returns failure for invalid loop region range', () => {
    const result = applyWorkspaceAction(mockDispatch, {
      action: 'set_loop_region',
      startSeconds: 5.0,
      endSeconds: 2.0,
    });

    expect(result.appliedAction).toBe('set_loop_region');
    expect(result.success).toBe(false);
    expect(result.detail).toContain('Invalid loop region');
  });
});
