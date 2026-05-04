import type { ApiEnvelope, ApiErrorShape, CaseRecord, Channel, EvidenceItem, ExtractionResult } from '../types/ocr';

const defaultBackendUrl = 'http://localhost:4000';

/** In-memory case data is lost between Vercel serverless instances; we keep a client snapshot to rehydrate. */
const CASE_SNAPSHOT_PREFIX = 'btn-ocr-case:';

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

function rememberCaseSnapshot(record: { id?: string } | Record<string, unknown> | null | undefined): void {
  if (typeof window === 'undefined' || !record || typeof record !== 'object' || !('id' in record) || !record.id) return;
  try {
    sessionStorage.setItem(`${CASE_SNAPSHOT_PREFIX}${String(record.id)}`, JSON.stringify(record));
  } catch {
    // quota / private mode
  }
}

function getCaseSnapshot(caseId: string): Record<string, unknown> | null {
  if (typeof window === 'undefined' || !caseId) return null;
  try {
    const raw = sessionStorage.getItem(`${CASE_SNAPSHOT_PREFIX}${caseId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listCaseSnapshots(): CaseRecord[] {
  if (typeof window === 'undefined') return [];
  const out: CaseRecord[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(CASE_SNAPSHOT_PREFIX)) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as CaseRecord;
        if (parsed?.id) out.push(parsed);
      } catch {
        // skip invalid entry
      }
    }
  } catch {
    // ignore
  }
  return out;
}

function mergeCaseLists(server: CaseRecord[], local: CaseRecord[]): CaseRecord[] {
  const map = new Map<string, CaseRecord>();
  for (const item of server) {
    map.set(item.id, item);
  }
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const tNew = new Date(item.updatedAt || 0).getTime();
    const tOld = new Date(existing.updatedAt || 0).getTime();
    map.set(item.id, tNew >= tOld ? item : existing);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  );
}

function withClientCase(caseId: string, body: Record<string, unknown>): Record<string, unknown> {
  const snap = getCaseSnapshot(caseId);
  if (!snap) return body;
  return { ...body, clientCase: snap };
}

export const apiClient = {
  backendUrl,
  createCase: async (channel: Channel) => {
    const data = await request<CaseRecord>('/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        applicant: { fullName: 'KPR Applicant' },
        property: { propertyType: 'house' },
      }),
    });
    rememberCaseSnapshot(data);
    return data;
  },
  saveLocation: async (caseId: string, rawAddressText: string) => {
    const data = await request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withClientCase(caseId, { rawAddressText })),
    });
    rememberCaseSnapshot(data);
    return data;
  },
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
      const snap = getCaseSnapshot(caseId);
      if (snap) {
        formData.append('clientCase', JSON.stringify(snap));
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
          rememberCaseSnapshot(payload.data.case);
          resolve(payload.data.case);
          return;
        }

        const message = payload && 'error' in payload ? payload.error : `Upload failed (${xhr.status})`;
        reject(new ApiError(message, xhr.status, payload && 'details' in payload ? payload.details : undefined));
      };

      xhr.send(formData);
    }),
  startExtraction: async (caseId: string) => {
    const extraction = await request<ExtractionResult>(`/cases/${encodeURIComponent(caseId)}/extraction/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withClientCase(caseId, {})),
    });
    const prev = getCaseSnapshot(caseId);
    if (prev) {
      rememberCaseSnapshot({
        ...prev,
        extraction,
        status: 'extraction_completed',
        updatedAt: new Date().toISOString(),
      });
    }
    return extraction;
  },
  getExtraction: async (caseId: string) => {
    try {
      return await request<ExtractionResult>(`/cases/${encodeURIComponent(caseId)}/extraction`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const snap = getCaseSnapshot(caseId);
        const ex = snap?.extraction;
        if (ex && typeof ex === 'object' && ex !== null) {
          return ex as ExtractionResult;
        }
      }
      throw error;
    }
  },
  getCases: async () => {
    let server: CaseRecord[] = [];
    try {
      server = await request<CaseRecord[]>('/cases');
    } catch {
      server = [];
    }
    return mergeCaseLists(server, listCaseSnapshots());
  },
  getEvidence: async (caseId: string) => {
    try {
      return await request<EvidenceItem[]>(`/cases/${encodeURIComponent(caseId)}/evidence`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const snap = getCaseSnapshot(caseId);
        const ev = snap?.evidence;
        if (Array.isArray(ev)) {
          return ev as EvidenceItem[];
        }
      }
      throw error;
    }
  },
  getCase: async (caseId: string) => {
    try {
      const data = await request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`);
      rememberCaseSnapshot(data);
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const snap = getCaseSnapshot(caseId);
        if (snap && typeof snap.id === 'string') {
          return snap as CaseRecord;
        }
      }
      throw error;
    }
  },
  patchCase: async (caseId: string, payload: Record<string, unknown>) => {
    const data = await request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withClientCase(caseId, payload)),
    });
    rememberCaseSnapshot(data);
    return data;
  },
  updateCaseStatus: async (caseId: string, status: string) => {
    const data = await request<CaseRecord>(`/cases/${encodeURIComponent(caseId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withClientCase(caseId, { status })),
    });
    rememberCaseSnapshot(data);
    return data;
  },
};
