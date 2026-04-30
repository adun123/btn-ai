import type { ApiEnvelope, ApiErrorShape, CaseRecord, Channel, ExtractionResult } from '../types/ocr';

const defaultBackendUrl = 'http://localhost:4000';

function normalizeBackendUrl(rawUrl: string): string {
  let normalized = rawUrl.trim();
  if (!normalized) {
    normalized = defaultBackendUrl;
  }

  normalized = normalized.replace(/\/+$/, '');

  // Avoid duplicated /api when callers also prepend /api in paths.
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }

  return normalized;
}

function ensureApiPath(path: string): string {
  const normalizedPath = `/${path.trim().replace(/^\/+/, '')}`;
  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return normalizedPath;
  }
  return `/api${normalizedPath}`;
}

function buildApiUrl(path: string): string {
  return `${backendUrl}${ensureApiPath(path)}`;
}

const backendUrl = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL || defaultBackendUrl);

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return {} as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    cache: 'no-store',
  });

  const payload = await parseResponse<ApiEnvelope<T> | ApiErrorShape>(response);

  if (!response.ok) {
    const message = 'error' in payload ? payload.error : `${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status, 'details' in payload ? payload.details : undefined);
  }

  return (payload as ApiEnvelope<T>).data;
}

export const apiClient = {
  backendUrl,
  createCase: (channel: Channel) =>
    request<CaseRecord>('/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        applicant: { fullName: 'KPR Applicant' },
        property: { propertyType: 'house' },
      }),
    }),
  saveLocation: (caseId: string, rawAddressText: string) =>
    request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAddressText }),
    }),
  uploadEvidence: ({
    caseId,
    documentType,
    file,
    notes,
    onProgress,
  }: {
    caseId: string;
    documentType: string;
    file: File;
    notes?: string;
    onProgress?: (percent: number) => void;
  }) =>
    new Promise<CaseRecord>((resolve, reject) => {
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('files', file);
      if (notes?.trim()) {
        formData.append('notes', notes.trim());
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildApiUrl(`/cases/${encodeURIComponent(caseId)}/evidence`));
      xhr.responseType = 'json';

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onerror = () => reject(new ApiError('Upload failed. Please retry.', 0));

      xhr.onload = () => {
        const payload = xhr.response as ApiEnvelope<{ case: CaseRecord }> | ApiErrorShape | null;
        if (xhr.status >= 200 && xhr.status < 300 && payload && 'data' in payload) {
          resolve(payload.data.case);
          return;
        }

        const message = payload && 'error' in payload ? payload.error : `Upload failed (${xhr.status})`;
        reject(new ApiError(message, xhr.status, payload && 'details' in payload ? payload.details : undefined));
      };

      xhr.send(formData);
    }),
  startExtraction: (caseId: string) =>
    request<ExtractionResult>(`/cases/${encodeURIComponent(caseId)}/extraction/start`, {
      method: 'POST',
    }),
  getExtraction: (caseId: string) => request<ExtractionResult>(`/cases/${encodeURIComponent(caseId)}/extraction`),
  getCase: (caseId: string) => request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`),
  patchCase: (caseId: string, payload: Record<string, unknown>) =>
    request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateCaseStatus: (caseId: string, status: string) =>
    request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
};
