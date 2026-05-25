import type { ApiEnvelope, ApiErrorShape } from '../types/ocr';
import type { BulkJob, BulkJobDetails } from '../types/bulk';
import { ApiError } from './api';

const defaultBackendUrl = 'http://localhost:4000';

function buildUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BACKEND_URL || defaultBackendUrl).replace(/\/+$/, '').replace(/\/api$/, '');
  return `${base}/api/bulk${path}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const payload = await res.json() as ApiEnvelope<T> | ApiErrorShape;
  if (!res.ok) {
    const msg = 'error' in payload ? payload.error : `${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return (payload as ApiEnvelope<T>).data;
}

export const bulkApi = {
  upload: async (files: File[]): Promise<{ jobId: string; status: string }> => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const res = await fetch(buildUrl('/upload'), { method: 'POST', body: form });
    const payload = await res.json() as ApiEnvelope<{ jobId: string; status: string }>;
    if (!res.ok) throw new ApiError('Upload failed', res.status);
    return payload.data;
  },

  getJobs: () => request<BulkJob[]>(buildUrl('/jobs')),

  getJob: (jobId: string) => request<BulkJob>(buildUrl(`/jobs/${jobId}`)),

  getJobDetails: (jobId: string) => request<BulkJobDetails>(buildUrl(`/jobs/${jobId}/details`)),
};
