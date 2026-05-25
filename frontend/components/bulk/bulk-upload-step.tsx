'use client';

import { useCallback, useState } from 'react';
import { Upload, FileArchive, Loader2 } from 'lucide-react';
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

export function BulkUploadStep({ onComplete }: { onComplete: (jobId: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [error, setError] = useState('');

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

  const handleSubmit = async () => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const { jobId } = await bulkApi.upload(files);
      // Poll until completed/failed
      const poll = async () => {
        const data = await bulkApi.getJob(jobId);
        setJob(data);
        if (data.status === 'completed') {
          onComplete(jobId);
        } else if (data.status === 'failed') {
          setError('Proses gagal. Silakan coba lagi.');
          setUploading(false);
        } else {
          setTimeout(poll, 1500);
        }
      };
      poll();
    } catch {
      setError('Upload gagal. Pastikan backend berjalan.');
      setUploading(false);
    }
  };

  const progress = job ? Math.round((job.processedPages / Math.max(job.totalPages, 1)) * 100) : 0;

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
    </div>
  );
}
