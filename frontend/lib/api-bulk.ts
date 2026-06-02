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
    // Step 1: Get presigned URLs from backend (small JSON request, no file data)
    const fileEntries = files.map(f => ({ filename: f.name, contentType: f.type }));
    const presignRes = await fetch(buildUrl('/presign'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileEntries }),
    });
    if (!presignRes.ok) throw new ApiError('Failed to get upload URLs', presignRes.status);
    const { data: presignData } = await presignRes.json() as ApiEnvelope<{
      uploadId: string;
      urls: { filename: string; path: string; signedUrl: string; token: string }[];
    }>;

    // Step 2: Upload each file directly to Supabase Storage (bypasses Vercel limit)
    await Promise.all(
      presignData.urls.map(async (urlInfo, i) => {
        const file = files[i];
        console.log(`[bulkApi] uploading ${file.name} to ${urlInfo.signedUrl.split('?')[0]}`);
        const res = await fetch(urlInfo.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`[bulkApi] upload failed for ${file.name}: ${res.status} ${body}`);
          throw new ApiError(`Failed to upload ${file.name}`, res.status);
        }
      })
    );

    // Step 3: Tell backend to process the uploaded files
    const processRes = await fetch(buildUrl('/process-storage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: presignData.uploadId,
        files: presignData.urls.map((u, i) => ({
          filename: u.filename,
          path: u.path,
          contentType: files[i].type,
        })),
      }),
    });
    if (!processRes.ok) {
      const body = await processRes.text().catch(() => '');
      console.error(`[bulkApi] process-storage failed: ${processRes.status} ${body}`);
      throw new ApiError('Processing failed', processRes.status);
    }
    const { data } = await processRes.json() as ApiEnvelope<{ jobId: string; status: string }>;
    return data;
  },

  getJobs: () => request<BulkJob[]>(buildUrl('/jobs')),

  getJob: (jobId: string) => request<BulkJob>(buildUrl(`/jobs/${jobId}`)),

  getJobDetails: (jobId: string) => request<BulkJobDetails>(buildUrl(`/jobs/${jobId}/details`)),
  deleteJob: (jobId: string) => request<void>(buildUrl(`/jobs/${jobId}`), { method: 'DELETE' }),
  deleteNasabah: (jobId: string, nasabahId: string) => request<void>(buildUrl(`/jobs/${jobId}/nasabah/${nasabahId}`), { method: 'DELETE' }),
};
