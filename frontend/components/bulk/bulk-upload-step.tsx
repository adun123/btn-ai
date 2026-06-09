'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileArchive, Loader2, History, XCircle, ChevronDown, Trash2 } from 'lucide-react';
import { bulkApi } from '../../lib/api-bulk';
import type { BulkJob, BulkJobStatus } from '../../types/bulk';

const STATUS_LABELS: Record<BulkJobStatus, string> = {
  pending: 'Menunggu...',
  extracting: 'Mengekstrak file...',
  ocr_processing: 'Memproses OCR...',
  classifying: 'Mengklasifikasi dokumen...',
  grouping: 'Mengelompokkan nasabah...',
  completed: 'Selesai!',
  failed: 'Gagal',
};

export function BulkUploadStep({ onComplete, onViewResult }: { onComplete: (jobId: string) => void; onViewResult: (jobId: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (uploading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [uploading]);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f =>
      f.type === 'application/zip' ||
      f.type === 'application/x-zip-compressed' ||
      f.type === 'application/pdf' ||
      f.type.startsWith('image/')
    );
    if (!arr.length) {
      setError('File harus berupa ZIP, PDF, atau gambar (PNG/JPG)');
      return;
    }
    setError('');
    setFiles(arr);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleCancel = () => {
    setCancelled(true);
    setUploading(false);
    setJob(null);
    setError('Proses dibatalkan.');
  };

  const handleSubmit = async () => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    setCancelled(false);
    setJob({ processedPages: 0, totalPages: files.length, status: 'ocr_processing' } as BulkJob);
    try {
      const { jobId, status } = await bulkApi.upload(files);
      if (cancelled) return;
      if (status === 'completed') {
        onComplete(jobId);
      } else if (status === 'failed') {
        setError('Proses gagal. Silakan coba lagi.');
        setUploading(false);
      } else {
        const poll = async () => {
          if (cancelled) return;
          const data = await bulkApi.getJob(jobId);
          setJob(data);
          if (data.status === 'completed') {
            onComplete(jobId);
          } else if (data.status === 'failed') {
            setError('Proses gagal. Silakan coba lagi.');
            setUploading(false);
          } else {
            setTimeout(poll, 2000);
          }
        };
        poll();
      }
    } catch (err) {
      console.error('[BulkUpload] Upload/process error:', err);
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Upload/proses gagal: ${msg}`);
        setUploading(false);
      }
    }
  };

  const progress = job ? Math.round((job.processedPages / Math.max(job.totalPages, 1)) * 100) : 0;

  // Processing state with cancel button
  if (uploading && job) {
    return (
      <div className="glass-card p-8 max-w-lg mx-auto text-center space-y-6">
        <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-lg font-medium">{STATUS_LABELS[job.status]}</p>
        <div className="w-full rounded-full h-3" style={{ background: 'var(--border)' }}>
          <div
            className="h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'var(--primary)' }}
          />
        </div>
        <p className="text-muted text-sm">
          {job.processedPages} / {job.totalPages} halaman diproses • {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} berlalu
        </p>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 transition hover:bg-red-100"
        >
          <XCircle className="h-4 w-4" /> Batalkan
        </button>
      </div>
    );
  }


  return (
    <div className="glass-card p-8 max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Upload Dokumen Bulk</h2>
        <p className="text-muted text-sm">Upload file ZIP atau pilih beberapa file PDF/gambar sekaligus</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? 'var(--primary)' : 'var(--border)',
          background: dragOver ? 'var(--primary-soft)' : 'transparent',
        }}
        onClick={() => document.getElementById('bulk-file-input')?.click()}
      >
        {files.length ? (
          <div className="space-y-2">
            <FileArchive className="w-8 h-8 mx-auto" style={{ color: 'var(--primary)' }} />
            <p className="font-medium">{files.length} file dipilih</p>
            <p className="text-muted text-xs">
              {files.map(f => f.name).slice(0, 3).join(', ')}
              {files.length > 3 && ` +${files.length - 3} lainnya`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted" />
            <p className="text-muted text-sm">Drag & drop file di sini, atau klik untuk memilih</p>
            <p className="text-muted text-xs">ZIP, PDF, PNG, JPG — maks 100MB</p>
          </div>
        )}
      </div>

      <input
        id="bulk-file-input"
        type="file"
        multiple
        accept=".zip,.pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!files.length || uploading}
        className="w-full py-3 rounded-xl font-medium text-white transition disabled:opacity-40"
        style={{ background: 'var(--primary)' }}
      >
        {uploading ? 'Mengupload...' : 'Proses Dokumen'}
      </button>

      {/* Riwayat Pemrosesan */}
      <JobHistory onViewResult={onViewResult} />
    </div>
  );
}

function JobHistory({ onViewResult }: { onViewResult: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    bulkApi.getJobs().then(j => { setJobs(j.filter(x => x.status === 'completed')); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !jobs.length) return null;

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!confirm('Hapus riwayat ini?')) return;
    try {
      await bulkApi.deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 py-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted" />
          <p className="text-sm font-semibold text-muted">Riwayat Pemrosesan ({jobs.length})</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {jobs.slice(0, 10).map(job => (
            <div
              key={job.id}
              className="flex items-center gap-2 rounded-xl border p-3 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <button onClick={() => onViewResult(job.id)} className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{job.uploadType === 'zip' ? '📦' : '📄'} {job.totalFiles} file • {job.totalPages} halaman</p>
                <p className="text-xs text-muted mt-0.5">
                  {new Date(job.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {job.failedPages > 0 && <span className="text-amber-600 ml-2">• {job.failedPages} gagal</span>}
                </p>
              </button>
              <button onClick={(e) => handleDelete(e, job.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
