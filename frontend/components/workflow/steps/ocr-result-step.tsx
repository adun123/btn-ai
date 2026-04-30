import type { ExtractionResult } from '../../../types/ocr';

type OcrResultStepProps = {
  extraction?: ExtractionResult;
  loading: boolean;
};

function formatFieldLabel(key: string): string {
  const aliasMap: Record<string, string> = {
    nik: 'NIK',
    npwp: 'NPWP',
    ktp: 'KTP',
    kk: 'KK',
    nama: 'Nama',
    alamat: 'Alamat',
    rt: 'RT',
    rw: 'RW',
  };

  return key
    .split('.')
    .map((part) =>
      part
        .split('_')
        .map((segment) => {
          const lower = segment.toLowerCase();
          if (aliasMap[lower]) return aliasMap[lower];
          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        })
        .join(' '),
    )
    .join(' -> ');
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

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
    return (
      <p className="rounded-2xl border border-blue-100 bg-white p-5 text-sm text-slate-600 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-300">
        OCR result belum tersedia. Jalankan proses OCR terlebih dahulu.
      </p>
    );
  }

  const fieldsNeedingReview = extraction.fields.filter((field) => field.reviewRequired).length;
  const averageConfidence =
    extraction.fields.length > 0
      ? Math.round((extraction.fields.reduce((sum, field) => sum + field.confidence, 0) / extraction.fields.length) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">OCR Result Overview</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ringkasan hasil ekstraksi dokumen berdasarkan pipeline <span className="font-medium text-slate-900 dark:text-slate-100">{extraction.pipeline}</span>.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">Status</p>
            <p className="mt-1 font-semibold capitalize text-slate-900 dark:text-slate-100">{extraction.status}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">Channel</p>
            <p className="mt-1 font-semibold capitalize text-slate-900 dark:text-slate-100">{extraction.channel}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">Avg Confidence</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{averageConfidence}%</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">Need Review</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{fieldsNeedingReview} field</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Generated at {new Date(extraction.generatedAt).toLocaleString()}</p>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Documents</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {(extraction.documents || []).map((doc) => (
            <article key={doc.evidenceId} className="rounded-xl border border-blue-100 bg-slate-50 p-3 dark:border-blue-900 dark:bg-slate-950/40">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{doc.filename}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatFieldLabel(doc.documentType)}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{doc.summary || 'Ringkasan dokumen tidak tersedia.'}</p>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Confidence: {formatConfidence(doc.confidence)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Extracted Fields</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {extraction.fields.length} fields
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {extraction.fields.map((field) => (
            <div key={field.key} className="rounded-xl border border-blue-100 bg-slate-50 p-3 dark:border-blue-900 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatFieldLabel(field.key)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Path: {field.key}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${field.reviewRequired ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                  {field.reviewRequired ? 'Needs review' : 'Auto'}
                </span>
              </div>
              <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">{field.value || '-'}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Source: {formatFieldLabel(field.source)}</span>
                <span>{formatConfidence(field.confidence)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-blue-700 dark:bg-blue-400" style={{ width: formatConfidence(field.confidence) }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {extraction.warnings.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">Warnings</h3>
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
