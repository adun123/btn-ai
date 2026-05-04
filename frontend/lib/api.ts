import type { ApiEnvelope, ApiErrorShape, CaseRecord, Channel, EvidenceItem, ExtractionResult } from '../types/ocr';

const defaultBackendUrl = 'http://localhost:4000';

/** In-memory case data is lost between Vercel serverless instances; we keep a client snapshot to rehydrate. */
const CASE_SNAPSHOT_PREFIX = 'btn-ocr-case:';
/** Per-evidence file bytes (base64) for OCR when the server instance does not hold the upload buffer. */
const EVIDENCE_BIN_PREFIX = 'btn-ocr-ev:';

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

function mergeEvidenceLists(a: EvidenceItem[], b: EvidenceItem[]): EvidenceItem[] {
  const map = new Map<string, EvidenceItem>();
  for (const item of a) {
    map.set(item.id, item);
  }
  for (const item of b) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const tNew = new Date(item.uploadedAt || 0).getTime();
    const tOld = new Date(existing.uploadedAt || 0).getTime();
    map.set(item.id, tNew >= tOld ? item : existing);
  }
  return Array.from(map.values());
}

/** Union evidence + prefer newer scalar fields from incoming (server). */
export function mergeCaseRecords(previous: CaseRecord | null | undefined, incoming: CaseRecord): CaseRecord {
  if (!previous) return incoming;
  const mergedEvidence = mergeEvidenceLists(previous.evidence || [], incoming.evidence || []);
  return {
    ...previous,
    ...incoming,
    evidence: mergedEvidence,
  };
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

function rememberCaseSnapshot(record: CaseRecord | Record<string, unknown> | null | undefined): void {
  if (typeof window === 'undefined' || !record || typeof record !== 'object' || !('id' in record) || !record.id) return;
  const id = String(record.id);
  try {
    const prevRaw = getCaseSnapshot(id);
    const prev = prevRaw ? ({ ...prevRaw, id: prevRaw.id as string } as CaseRecord) : null;
    const incoming = record as CaseRecord;
    const merged = mergeCaseRecords(prev, incoming);
    sessionStorage.setItem(`${CASE_SNAPSHOT_PREFIX}${id}`, JSON.stringify(merged));
  } catch {
    // quota / private mode
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
    map.set(item.id, existing ? mergeCaseRecords(existing, item) : item);
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

/** Strip heavy fields before POSTing case JSON with large base64 blobs (Vercel ~4.5MB body cap). */
function slimClientCaseForRehydration(snap: Record<string, unknown>): Record<string, unknown> {
  return {
    id: snap.id,
    referenceNumber: snap.referenceNumber,
    channel: snap.channel,
    status: snap.status,
    applicant: snap.applicant,
    property: snap.property,
    notes: snap.notes,
    location: snap.location,
    evidence: snap.evidence,
    extraction: snap.extraction,
    manualExtractionEdits: snap.manualExtractionEdits,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
    auditTrail: [],
  };
}

const MAX_OCR_IMAGE_EDGE = 1280;
const JPEG_QUALITY = 0.72;
/** ~260KB binary in base64; recompress if client has older full-res blobs in sessionStorage. */
const MAX_BASE64_CHARS_BEFORE_RESHRINK = 400_000;

/** Vercel serverless rejects bodies ~>4.5MB; stay under with JSON overhead + clientCase. */
const VERCEL_EXTRACTION_JSON_BUDGET_CHARS = 3_500_000;

type ShrinkImageOpts = { maxEdge?: number; jpegQuality?: number };

async function shrinkImageFileForOcr(
  file: File,
  opts?: ShrinkImageOpts,
): Promise<{ base64Data: string; mimeType: string }> {
  const maxEdge = opts?.maxEdge ?? MAX_OCR_IMAGE_EDGE;
  const jpegQuality = opts?.jpegQuality ?? JPEG_QUALITY;

  if (!file.type.startsWith('image/')) {
    const base64Data = await fileToBase64(file);
    return { base64Data, mimeType: file.type || 'application/octet-stream' };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const base64Data = await fileToBase64(file);
    return { base64Data, mimeType: file.type || 'application/octet-stream' };
  }

  try {
    let { width, height } = bitmap;
    if (width > maxEdge || height > maxEdge) {
      const scale = Math.min(maxEdge / width, maxEdge / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const base64Data = await fileToBase64(file);
      return { base64Data, mimeType: file.type || 'image/jpeg' };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const outMime = 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), outMime, jpegQuality),
    );
    if (!blob) {
      const base64Data = await fileToBase64(file);
      return { base64Data, mimeType: file.type || 'image/jpeg' };
    }

    const base64Data = await blobToBase64(blob);
    return { base64Data, mimeType: outMime };
  } finally {
    bitmap.close();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.includes(',') ? r.split(',')[1] || '' : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function maybeShrinkCachedImagePayload(parsed: {
  base64Data: string;
  mimeType: string;
}): Promise<{ base64Data: string; mimeType: string }> {
  const { base64Data, mimeType } = parsed;
  if (!mimeType.startsWith('image/') || base64Data.length <= MAX_BASE64_CHARS_BEFORE_RESHRINK) {
    return parsed;
  }
  try {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'evidence.bin', { type: mimeType });
    return shrinkImageFileForOcr(file);
  } catch {
    return parsed;
  }
}

async function shrinkBase64ImageForOcr(
  base64Data: string,
  mimeType: string,
  shrinkOpts: { maxEdge: number; jpegQuality: number },
): Promise<{ base64Data: string; mimeType: string }> {
  if (!mimeType.startsWith('image/')) {
    return { base64Data, mimeType };
  }
  try {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'evidence.bin', { type: mimeType });
    return shrinkImageFileForOcr(file, shrinkOpts);
  } catch {
    return { base64Data, mimeType };
  }
}

async function fitEvidenceFilePayloadsUnderBudget(
  slimClientCase: Record<string, unknown> | undefined,
  payloads: Record<string, { base64Data: string; mimeType: string }>,
): Promise<Record<string, { base64Data: string; mimeType: string }>> {
  const measure = (p: Record<string, { base64Data: string; mimeType: string }>) => {
    const shell: Record<string, unknown> = {};
    if (slimClientCase) shell.clientCase = slimClientCase;
    if (Object.keys(p).length > 0) shell.evidenceFilePayloads = p;
    return JSON.stringify(shell).length;
  };

  let current: Record<string, { base64Data: string; mimeType: string }> = { ...payloads };
  const tiers = [
    { maxEdge: 1280, jpegQuality: 0.72 },
    { maxEdge: 1024, jpegQuality: 0.65 },
    { maxEdge: 896, jpegQuality: 0.58 },
    { maxEdge: 768, jpegQuality: 0.52 },
    { maxEdge: 640, jpegQuality: 0.46 },
  ];
  let tierIdx = 0;
  let guard = 0;
  while (measure(current) > VERCEL_EXTRACTION_JSON_BUDGET_CHARS && guard < 100) {
    const ids = Object.keys(current);
    if (!ids.length) break;
    let maxId = ids[0]!;
    let maxLen = current[maxId]?.base64Data.length ?? 0;
    for (const id of ids) {
      const len = current[id]?.base64Data.length ?? 0;
      if (len > maxLen) {
        maxLen = len;
        maxId = id;
      }
    }
    const t = tiers[Math.min(tierIdx, tiers.length - 1)]!;
    const prev = current[maxId]!;
    current = {
      ...current,
      [maxId]: await shrinkBase64ImageForOcr(prev.base64Data, prev.mimeType, t),
    };
    guard += 1;
    if (guard % 3 === 0 && tierIdx < tiers.length - 1) tierIdx += 1;
  }
  return current;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const base64 = r.includes(',') ? r.split(',')[1] || '' : r;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function storeEvidenceBlobForNewUpload(
  caseId: string,
  documentType: string,
  file: File,
  serverCase: CaseRecord,
): Promise<void> {
  const prevSnap = getCaseSnapshot(caseId);
  const prevEvidence = (prevSnap?.evidence as EvidenceItem[] | undefined) || [];
  const prevIds = new Set(prevEvidence.map((e) => e.id));
  const merged = mergeCaseRecords(prevSnap as CaseRecord | null, serverCase);
  const added = (merged.evidence || []).filter((e) => !prevIds.has(e.id));
  const match =
    added.find((e) => e.documentType === documentType && e.filename === file.name) ||
    added.find((e) => e.documentType === documentType) ||
    added[added.length - 1];
  if (!match) return;
  try {
    const { base64Data, mimeType } = await shrinkImageFileForOcr(file);
    sessionStorage.setItem(
      `${EVIDENCE_BIN_PREFIX}${match.id}`,
      JSON.stringify({
        base64Data,
        mimeType,
      }),
    );
  } catch {
    // quota exceeded — extraction may fail on another instance
  }
}

async function collectEvidenceFilePayloads(
  evidence: EvidenceItem[],
): Promise<Record<string, { base64Data: string; mimeType: string }>> {
  const out: Record<string, { base64Data: string; mimeType: string }> = {};
  if (typeof window === 'undefined') return out;
  for (const item of evidence) {
    try {
      const raw = sessionStorage.getItem(`${EVIDENCE_BIN_PREFIX}${item.id}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { base64Data?: string; mimeType?: string };
      if (parsed?.base64Data) {
        const mimeType = parsed.mimeType || 'application/octet-stream';
        out[item.id] = await maybeShrinkCachedImagePayload({
          base64Data: parsed.base64Data,
          mimeType,
        });
      }
    } catch {
      // skip
    }
  }
  return out;
}

/** Clear cached blobs (e.g. new workflow). Does not remove case JSON snapshots. */
export function clearAllEvidenceBlobs(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(EVIDENCE_BIN_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export const apiClient = {
  backendUrl,
  createCase: async (channel: Channel) => {
    clearAllEvidenceBlobs();
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
          void (async () => {
            try {
              await storeEvidenceBlobForNewUpload(caseId, documentType, file, payload.data.case);
            } catch {
              // non-fatal
            }
            rememberCaseSnapshot(payload.data.case);
            resolve(payload.data.case);
          })();
          return;
        }

        const message = payload && 'error' in payload ? payload.error : `Upload failed (${xhr.status})`;
        reject(new ApiError(message, xhr.status, payload && 'details' in payload ? payload.details : undefined));
      };

      xhr.send(formData);
    }),
  startExtraction: async (caseId: string) => {
    const snap = getCaseSnapshot(caseId) as CaseRecord | null;
    const evidence = (snap?.evidence as EvidenceItem[] | undefined) || [];
    const slim = snap ? slimClientCaseForRehydration(snap) : undefined;
    let evidenceFilePayloads = await collectEvidenceFilePayloads(evidence);
    if (Object.keys(evidenceFilePayloads).length > 0) {
      evidenceFilePayloads = await fitEvidenceFilePayloadsUnderBudget(slim, evidenceFilePayloads);
    }
    const body: Record<string, unknown> = {};
    if (slim) {
      body.clientCase = slim;
    }
    if (Object.keys(evidenceFilePayloads).length > 0) {
      body.evidenceFilePayloads = evidenceFilePayloads;
    }

    const extraction = await request<ExtractionResult>(`/cases/${encodeURIComponent(caseId)}/extraction/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      const list = await request<EvidenceItem[]>(`/cases/${encodeURIComponent(caseId)}/evidence`);
      const snap = getCaseSnapshot(caseId);
      const local = snap?.evidence;
      if (Array.isArray(local)) {
        return mergeEvidenceLists(list, local as EvidenceItem[]);
      }
      return list;
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
      const snap = getCaseSnapshot(caseId) as CaseRecord | null;
      const merged = mergeCaseRecords(snap, data);
      rememberCaseSnapshot(merged);
      return merged;
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
