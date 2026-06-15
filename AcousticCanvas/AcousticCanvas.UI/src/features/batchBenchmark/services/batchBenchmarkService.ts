import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import type { BenchmarkProgress } from '../store/batchBenchmarkSlice';
import type { BatchBenchmarkRequest, BatchBenchmarkResult } from '../types/batchBenchmarkTypes';

const API_BASE_URL = 'http://localhost:5146';

export async function callBatchBenchmarkTool(
  input: BatchBenchmarkRequest,
  onProgress?: (event: BenchmarkProgress) => void,
): Promise<BatchBenchmarkResult> {
  const url = `${API_BASE_URL}/${API_ENDPOINTS.AUDIO.RUN_BATCH_BENCHMARK}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileIds: input.fileIds,
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Benchmark request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const event = JSON.parse(trimmed) as { type: string; completed?: number; total?: number; fileName?: string; data?: BatchBenchmarkResult; message?: string };

      if (event.type === 'progress' && onProgress) {
        onProgress({ completed: event.completed!, total: event.total!, fileName: event.fileName! });
      } else if (event.type === 'result' && event.data) {
        return event.data;
      } else if (event.type === 'error') {
        throw new Error(event.message ?? 'Benchmark failed');
      }
    }
  }

  throw new Error('Benchmark stream ended without a result');
}
