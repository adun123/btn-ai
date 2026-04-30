import { LoaderCircle } from 'lucide-react';

type OcrProcessStepProps = {
  loading: boolean;
  documentCount: number;
  error?: string;
  onStart: () => void;
};

export function OcrProcessStep({ loading, documentCount, error, onStart }: OcrProcessStepProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-blue-100 bg-white p-6 text-center dark:border-blue-900 dark:bg-slate-900">
      <LoaderCircle className={`h-10 w-10 text-blue-700 dark:text-blue-300 ${loading ? 'animate-spin' : ''}`} />
      <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Processing your documents...</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Total uploaded documents: {documentCount}</p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
      <button
        type="button"
        onClick={onStart}
        disabled={loading || documentCount < 1}
        className="mt-5 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        {loading ? 'Running OCR...' : error ? 'Retry OCR' : 'Start OCR'}
      </button>
    </div>
  );
}
