import type { CaseRecord, ExtractionResult } from '../../types/ocr';

type SummaryPanelProps = {
  caseId: string;
  channel: string;
  caseData?: CaseRecord;
  extraction?: ExtractionResult;
  loading: boolean;
  notesDraft: string;
  notesSaving: boolean;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
};

export function SummaryPanel({
  caseId,
  channel,
  caseData,
  extraction,
  loading,
  notesDraft,
  notesSaving,
  onNotesChange,
  onSaveNotes,
}: SummaryPanelProps) {
  const uploadedDocumentsCount = (() => {
    const evidence = caseData?.evidence || [];
    if (channel !== 'bale') return evidence.length;
    return new Set(evidence.map((item) => item.documentType)).size;
  })();
  const extractionFieldsCount = (() => {
    const fields = extraction?.fields || [];
    if (channel !== 'bale') return fields.length;
    // Bale can include duplicate keys when users re-upload same document type.
    return new Set(fields.map((field) => field.key)).size;
  })();

  return (
    <aside className="glass-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">Case Summary</h3>
      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className="text-slate-600 dark:text-slate-300">Case ID</p>
          <p className="break-all font-medium text-slate-900 dark:text-slate-100">{caseId || 'Not created yet'}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-300">Channel</p>
          <p className="font-medium capitalize text-slate-900 dark:text-slate-100">{channel}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-300">Status</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{caseData?.status || 'draft'}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-300">Uploaded documents</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{uploadedDocumentsCount}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-300">Extraction fields</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{extractionFieldsCount}</p>
        </div>
        
      </div>
      {loading ? <div className="mt-5 h-2 animate-pulse rounded-full bg-blue-100 dark:bg-blue-950/50" /> : null}
    </aside>
  );
}
