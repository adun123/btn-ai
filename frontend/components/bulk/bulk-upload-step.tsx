'use client';

import { useCallback, useState } from 'react';
import { Upload, FileArchive, Loader2, History, XCircle } from 'lucide-react';
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
          {job.processedPages} / {job.totalPages} halaman diproses
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

      {/* View previous results */}
      <button
        onClick={async () => {
          try {
            const jobs = await bulkApi.getJobs();
            const last = jobs.find(j => j.status === 'completed');
            if (last) onViewResult(last.id);
            else setError('Belum ada hasil pemrosesan sebelumnya.');
          } catch { setError('Gagal memuat data.'); }
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition hover:opacity-80"
        style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
      >
        <History className="h-4 w-4" /> Lihat Hasil Sebelumnya
      </button>
    </div>
  );
}
