import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import type { CaseRecord, Channel } from '../../../types/ocr';

type CreateCaseStepProps = {
  selectedChannel: Channel;
  loading: boolean;
  recentCases?: CaseRecord[];
  deletingCaseId?: string | null;
  onSelectChannel: (channel: Channel) => void;
  onStart: () => void;
  onOpenCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
};

export function CreateCaseStep({
  selectedChannel,
  loading,
  recentCases = [],
  deletingCaseId,
  onSelectChannel,
  onStart,
  onOpenCase,
  onDeleteCase,
}: CreateCaseStepProps) {
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

      {recentCases.length ? (
        <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Cases</p>
          <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {recentCases.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 transition hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <button
                  type="button"
                  onClick={() => onOpenCase(item.id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="truncate">{item.id.slice(0, 8)}... - {item.channel}</span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {item.status.replaceAll('_', ' ')}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete case ${item.id}`}
                  title="Delete draft"
                  disabled={deletingCaseId === item.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteCase(item.id);
                  }}
                  className="rounded-md p-1 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
