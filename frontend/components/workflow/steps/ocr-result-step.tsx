import type { ExtractionResult } from '../../../types/ocr';

type OcrResultStepProps = {
  extraction?: ExtractionResult;
  loading: boolean;
};

export function OcrResultStep({ extraction, loading }: OcrResultStepProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-blue-100 dark:bg-blue-950/50" />
        <div className="h-40 animate-pulse rounded-2xl bg-blue-100 dark:bg-blue-950/50" />
      </div>
    );
  }

  if (!extraction) {
    return <p className="rounded-2xl border border-blue-100 bg-white p-5 text-sm text-slate-600 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-300">No OCR result yet.</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Summary</h3>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <p>Status: <span className="font-medium text-slate-900 dark:text-slate-100">{extraction.status}</span></p>
          <p>Channel: <span className="font-medium capitalize text-slate-900 dark:text-slate-100">{extraction.channel}</span></p>
          <p>Timestamp: <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(extraction.generatedAt).toLocaleString()}</span></p>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Documents</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(extraction.documents || []).map((doc) => (
            <p key={doc.evidenceId} className="rounded-xl bg-blue-50 px-3 py-2 text-slate-700 dark:bg-blue-950/30 dark:text-slate-200">
              {doc.filename} ({doc.documentType}) - confidence {Math.round(doc.confidence * 100)}%
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Extracted Fields</h3>
        <div className="mt-3 space-y-2">
          {extraction.fields.map((field) => (
            <div key={field.key} className="rounded-xl border border-blue-100 p-3 dark:border-blue-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{field.key}</p>
                <span className={`rounded-full px-2 py-1 text-xs ${field.reviewRequired ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {field.reviewRequired ? 'Needs review' : 'Auto'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{field.value || '-'}</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-blue-700 dark:bg-blue-400" style={{ width: `${Math.round(field.confidence * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {extraction.warnings.length ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/40">
          <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200">Warnings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800 dark:text-blue-200">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
