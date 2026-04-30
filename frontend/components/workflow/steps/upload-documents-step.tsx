import clsx from 'clsx';
import { Camera, FileUp } from 'lucide-react';
import { useMemo } from 'react';

type UploadItem = {
  documentType: string;
  status: 'empty' | 'uploaded' | 'error' | 'uploading';
  notes: string;
  progress: number;
  error?: string;
};

type UploadDocumentsStepProps = {
  items: UploadItem[];
  loading: boolean;
  allowedMimeTypes: string[];
  onUpload: (documentType: string, file: File) => void;
  onNoteChange: (documentType: string, notes: string) => void;
  onRetry: (documentType: string) => void;
};

function statusClass(status: UploadItem['status']) {
  if (status === 'uploaded') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'error') return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200';
  if (status === 'uploading') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export function UploadDocumentsStep({
  items,
  loading,
  allowedMimeTypes,
  onUpload,
  onNoteChange,
  onRetry,
}: UploadDocumentsStepProps) {
  const acceptAttr = useMemo(
    () =>
      allowedMimeTypes
        .map((item) => {
          if (item === 'image/jpeg') return '.jpg,.jpeg';
          if (item === 'image/png') return '.png';
          if (item === 'image/webp') return '.webp';
          if (item === 'application/pdf') return '.pdf';
          return item;
        })
        .join(','),
    [allowedMimeTypes],
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upload Documents</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Max 10MB per file. Upload status updates per document card.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.documentType}
            className={clsx(
              'rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900',
              item.status === 'uploaded'
                ? 'border-emerald-300 dark:border-emerald-700'
                : item.status === 'error'
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-blue-100 dark:border-blue-900',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/50">
                  <FileUp className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.documentType}</p>
              </div>
              <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', statusClass(item.status))}>
                {item.status}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block cursor-pointer rounded-xl border border-dashed border-blue-200 p-3 text-center text-xs text-slate-600 hover:bg-blue-50 dark:border-blue-800 dark:text-slate-300 dark:hover:bg-blue-950/30">
                <span className="inline-flex items-center gap-1"><FileUp className="h-3.5 w-3.5" /> Upload file</span>
                <input
                  type="file"
                  accept={acceptAttr}
                  className="hidden"
                  disabled={loading || item.status === 'uploading'}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(item.documentType, file);
                    event.target.value = '';
                  }}
                />
              </label>
              <label className="block cursor-pointer rounded-xl border border-dashed border-blue-200 p-3 text-center text-xs text-slate-600 hover:bg-blue-50 dark:border-blue-800 dark:text-slate-300 dark:hover:bg-blue-950/30">
                <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Use camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={loading || item.status === 'uploading'}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(item.documentType, file);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            <input
              className="input-base mt-3 py-2 text-xs"
              placeholder="Notes (optional)"
              value={item.notes}
              onChange={(event) => onNoteChange(item.documentType, event.target.value)}
            />

            {item.status === 'uploading' ? (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-2 rounded-full bg-blue-700 transition-all dark:bg-blue-400" style={{ width: `${item.progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.progress}%</p>
              </div>
            ) : null}

            {item.error ? (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">
                {item.error}
                <button type="button" onClick={() => onRetry(item.documentType)} className="ml-2 underline">
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

    </div>
  );
}
