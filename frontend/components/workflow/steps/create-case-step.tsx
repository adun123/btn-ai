import clsx from 'clsx';
import type { Channel } from '../../../types/ocr';

type CreateCaseStepProps = {
  selectedChannel: Channel;
  loading: boolean;
  onSelectChannel: (channel: Channel) => void;
  onStart: () => void;
};

export function CreateCaseStep({ selectedChannel, loading, onSelectChannel, onStart }: CreateCaseStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Create a New OCR Case</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose a channel first. All next actions will follow the same caseId.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectChannel('branch')}
          className={clsx(
            'rounded-2xl border p-5 text-left transition',
            selectedChannel === 'branch'
              ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
              : 'border-blue-100 bg-white dark:border-blue-900 dark:bg-slate-900',
          )}
        >
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Branch (Simulation)</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Template orchestration for branch style block-form OCR.</p>
        </button>
        <button
          type="button"
          onClick={() => onSelectChannel('bale')}
          className={clsx(
            'rounded-2xl border p-5 text-left transition',
            selectedChannel === 'bale'
              ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
              : 'border-blue-100 bg-white dark:border-blue-900 dark:bg-slate-900',
          )}
        >
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Bale (AI OCR)</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Gemini OCR for KTP, KK, and slip gaji documents.</p>
        </button>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className="w-full rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 sm:w-auto"
      >
        {loading ? 'Starting case...' : 'Start Case'}
      </button>
    </div>
  );
}
