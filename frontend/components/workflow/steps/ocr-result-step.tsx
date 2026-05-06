import type { ExtractionResult } from '../../../types/ocr';
import { getDocumentLabel } from '../../../lib/document-labels';
import { useEffect, useMemo, useState } from 'react';

type OcrResultStepProps = {
  extraction?: ExtractionResult;
  loading: boolean;
  persistedManualEdits?: Record<string, string>;
  savingManualEdits: boolean;
  onSaveManualEdits: (edits: Record<string, string>) => void;
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

function shouldHideField(documentType: string | undefined, fieldKey: string): boolean {
  const normalizedDocumentType = documentType?.toLowerCase();
  const rootFieldKey = fieldKey.toLowerCase().split('.')[0];

  if (normalizedDocumentType === 'npwp' && ['nik', 'kpp_registered'].includes(rootFieldKey)) return true;
  if (normalizedDocumentType === 'kk' && rootFieldKey === 'members') return true;
  if (normalizedDocumentType === 'rekening_koran' && rootFieldKey === 'transactions') return true;

  return false;
}

function shouldHideGlobalField(fieldKey: string): boolean {
  const [documentType, ...fieldKeyParts] = fieldKey.split('.');

  if (!fieldKeyParts.length) {
    return shouldHideField(undefined, fieldKey);
  }

  return shouldHideField(documentType, fieldKeyParts.join('.'));
}
export function OcrResultStep({
  extraction,
  loading,
  persistedManualEdits = {},
  savingManualEdits,
  onSaveManualEdits,
}: OcrResultStepProps) {
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({});
  const visibleDocuments = useMemo(
    () =>
      (extraction?.documents || []).map((doc) => ({
        ...doc,
        fields: doc.fields.filter((field) => !shouldHideField(doc.documentType, field.key)),
      })),
    [extraction?.documents],
  );
  const visibleGlobalFields = useMemo(
    () => (extraction?.fields || []).filter((field) => !shouldHideGlobalField(field.key)),
    [extraction?.fields],
  );

  const originalValues = useMemo(() => {
    const map: Record<string, string> = {};
    if (!extraction) return map;
    visibleDocuments.forEach((doc) => {
      doc.fields.forEach((field) => {
        map[`${doc.evidenceId}:${field.key}`] = field.value || '';
      });
    });
    visibleGlobalFields.forEach((field) => {
      map[`global:${field.key}`] = field.value || '';
    });
    return map;
  }, [extraction, visibleDocuments, visibleGlobalFields]);

  useEffect(() => {
    setManualEdits(persistedManualEdits || {});
  }, [persistedManualEdits, extraction?.generatedAt]);

  const documentWarnings = useMemo(
    () =>
      visibleDocuments.flatMap((doc) =>
        doc.warnings.map((warning) => ({
          key: `${doc.evidenceId}:${warning}`,
          warning,
          documentType: doc.documentType,
          filename: doc.filename,
        })),
      ),
    [visibleDocuments],
  );

  const globalWarnings = useMemo(() => {
    const documentWarningSet = new Set(documentWarnings.map((item) => item.warning));
    return (extraction?.warnings || []).filter((warning) => !documentWarningSet.has(warning));
  }, [documentWarnings, extraction?.warnings]);

  const resolveValue = (key: string, fallback: string | null) => (manualEdits[key] ?? fallback ?? '');
  const isEdited = (key: string) => (manualEdits[key] ?? originalValues[key] ?? '') !== (originalValues[key] ?? '');

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

  const fieldsNeedingReview = visibleGlobalFields.filter((field) => field.reviewRequired).length;
  const averageConfidence =
    visibleGlobalFields.length > 0
      ? Math.round((visibleGlobalFields.reduce((sum, field) => sum + field.confidence, 0) / visibleGlobalFields.length) * 100)
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

      {/* <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Documents</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {(extraction.documents || []).map((doc) => (
            <article key={doc.evidenceId} className="rounded-xl border border-blue-100 bg-slate-50 p-3 dark:border-blue-900 dark:bg-slate-950/40">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{doc.filename}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{getDocumentLabel(doc.documentType)}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{doc.summary || 'Ringkasan dokumen tidak tersedia.'}</p>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Confidence: {formatConfidence(doc.confidence)}</p>
            </article>
          ))}
        </div>
      </section> */}

      <section className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-blue-900 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Extraction Tables</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {visibleDocuments.length} dokumen
            </span>
            <button
              type="button"
              onClick={() => onSaveManualEdits(manualEdits)}
              disabled={savingManualEdits}
              className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-blue-600"
            >
              {savingManualEdits ? 'Saving...' : 'Save edits'}
            </button>
          </div>
        </div>
        {visibleDocuments.length ? (
          <div className="mt-4 space-y-4">
            {visibleDocuments.map((doc) => (
              <div key={doc.evidenceId} className="overflow-hidden rounded-xl border border-blue-100 dark:border-blue-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{getDocumentLabel(doc.documentType)}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{doc.filename}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2">Field</th>
                        <th className="px-4 py-2">Value</th>
                        <th className="px-4 py-2">Confidence</th>
                        <th className="px-4 py-2">Source</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.fields.map((field) => (
                        <tr key={`${doc.evidenceId}-${field.key}`} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{formatFieldLabel(field.key)}</td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          <div className="flex items-start gap-2">
                              <textarea
                                rows={3}
                                className="input-base min-h-[88px] w-full resize-y px-3 py-2 text-sm leading-relaxed"
                                value={resolveValue(`${doc.evidenceId}:${field.key}`, field.value)}
                                onChange={(event) =>
                                  setManualEdits((prev) => ({
                                    ...prev,
                                    [`${doc.evidenceId}:${field.key}`]: event.target.value,
                                  }))
                                }
                              />
                              {isEdited(`${doc.evidenceId}:${field.key}`) ? (
                                <span className="mt-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                Edited
                              </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatConfidence(field.confidence)}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatFieldLabel(field.source)}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${field.reviewRequired ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                              {field.reviewRequired ? 'Needs review' : 'Auto'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-blue-100 dark:border-blue-900">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2">Value</th>
                  <th className="px-4 py-2">Confidence</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleGlobalFields.map((field) => (
                  <tr key={field.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{formatFieldLabel(field.key)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                    <div className="flex items-start gap-2">
                            <textarea
                              rows={3}
                              className="input-base min-h-[88px] w-full resize-y px-3 py-2 text-sm leading-relaxed"
                              value={resolveValue(`global:${field.key}`, field.value)}
                              onChange={(event) =>
                                setManualEdits((prev) => ({
                                  ...prev,
                                  [`global:${field.key}`]: event.target.value,
                                }))
                              }
                            />
                        {isEdited(`global:${field.key}`) ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            Edited
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatConfidence(field.confidence)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatFieldLabel(field.source)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${field.reviewRequired ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                        {field.reviewRequired ? 'Needs review' : 'Auto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {globalWarnings.length || documentWarnings.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">Warnings</h3>
          <div className="mt-3 space-y-3 text-sm text-blue-800 dark:text-blue-200">
            {documentWarnings.map((item) => (
              <div key={item.key} className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2 dark:border-amber-900/70 dark:bg-slate-950/20">
                <p>{item.warning}</p>
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                  Referred file: {getDocumentLabel(item.documentType)} - {item.filename}
                </p>
              </div>
            ))}
            {globalWarnings.map((warning) => (
              <div key={warning} className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2 dark:border-amber-900/70 dark:bg-slate-950/20">
                <p>{warning}</p>
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">Referred file: General extraction result</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
