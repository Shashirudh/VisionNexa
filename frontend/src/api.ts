import type { ExplainResponse, ModelStatus } from './types';

const API_BASE = '/api';

export async function fetchModelStatus(): Promise<ModelStatus> {
  const response = await fetch(`${API_BASE}/model-status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model status: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function explainScan(file: File): Promise<ExplainResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/explain`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = 'Failed to analyze retinal image';
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      errorDetail = `${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
