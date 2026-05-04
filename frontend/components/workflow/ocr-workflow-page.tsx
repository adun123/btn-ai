'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Bot, CircleAlert, X } from 'lucide-react';
import { apiClient, ApiError, clearAllEvidenceBlobs, mergeCaseRecords } from '../../lib/api';
import { getDocumentLabel } from '../../lib/document-labels';
import { docsByChannel } from '../../lib/workflow';
import { useWorkflowStore } from '../../store/workflow-store';
import type { CaseRecord, EvidenceItem, ExtractionResult, WorkflowStep } from '../../types/ocr';
import { BtnLogo } from '../branding/btn-logo';
import { SummaryPanel } from './summary-panel';
import { Stepper } from './stepper';
import { CreateCaseStep } from './steps/create-case-step';
import { OcrProcessStep } from './steps/ocr-process-step';
import { OcrResultStep } from './steps/ocr-result-step';
import { UploadDocumentsStep } from './steps/upload-documents-step';

type UploadState = {
  status: 'empty' | 'uploaded' | 'error' | 'uploading';
  notes: string;
  progress: number;
  lastFile?: File;
  savedFilename?: string;
  savedAt?: string;
  error?: string;
};

const upsertCaseIntoCasesCache = (previous: CaseRecord[] | undefined, nextCase: CaseRecord): CaseRecord[] => {
  const existingCase = previous?.find((item) => item.id === nextCase.id);
  const mergedCase = existingCase ? mergeCaseRecords(existingCase, nextCase) : nextCase;

  return [mergedCase, ...(previous || []).filter((item) => item.id !== nextCase.id)];
};

export function OcrWorkflowPage() {
  const queryClient = useQueryClient();
  const { caseId, channel, currentStep, setCase, setStep, reset } = useWorkflowStore();
  const [globalError, setGlobalError] = useState<string>('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [extractionData, setExtractionData] = useState<ExtractionResult | undefined>(undefined);
  const [uploadMap, setUploadMap] = useState<Record<string, UploadState>>({});
  const [notesDraft, setNotesDraft] = useState('');
  const [deletingCaseId, setDeletingCaseId] = useState('');
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const docTypes = docsByChannel[channel];

  const caseQuery = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiClient.getCase(caseId),
    enabled: Boolean(caseId),
  });

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: () => apiClient.getCases(),
  });

  const evidenceQuery = useQuery({
    queryKey: ['evidence', caseId],
    queryFn: () => apiClient.getEvidence(caseId),
    enabled: Boolean(caseId),
  });

  const persistedEvidenceByType = useMemo(() => {
    const evidence = evidenceQuery.data || caseQuery.data?.evidence || [];
    return evidence.reduce<Record<string, EvidenceItem>>((acc, item) => {
      const current = acc[item.documentType];
      if (!current || new Date(item.uploadedAt).getTime() >= new Date(current.uploadedAt).getTime()) {
        acc[item.documentType] = item;
      }
      return acc;
    }, {});
  }, [caseQuery.data?.evidence, evidenceQuery.data]);

  const uploadItems = useMemo(
    () =>
      docTypes.map((documentType) => {
        const localState = uploadMap[documentType];
        if (localState) {
          return {
            documentType,
            ...localState,
          };
        }

        const persistedEvidence = persistedEvidenceByType[documentType];
        if (persistedEvidence) {
          return {
            documentType,
            status: 'uploaded' as const,
            notes: persistedEvidence.notes || '',
            progress: 100,
            savedFilename: persistedEvidence.filename,
            savedAt: persistedEvidence.uploadedAt,
          };
        }

        return { documentType, status: 'empty' as const, notes: '', progress: 0 };
      }),
    [docTypes, persistedEvidenceByType, uploadMap],
  );

  const createCase = useMutation({
    mutationFn: apiClient.createCase,
    onSuccess: (nextCase) => {
      setCase({ caseId: nextCase.id, channel: nextCase.channel });
      setStep(2);
      setGlobalError('');
      setNotesDraft(nextCase.notes || '');
      queryClient.invalidateQueries({ queryKey: ['case', nextCase.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setUploadMap({});
      void apiClient.updateCaseStatus(nextCase.id, 'case_created');
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to create case'),
  });

  const startExtraction = useMutation({
    mutationFn: async () => {
      await apiClient.startExtraction(caseId);
      return apiClient.getExtraction(caseId);
    },
    onSuccess: (payload) => {
      setExtractionData(payload);
      setStep(4);
      setGlobalError('');
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      void apiClient.updateCaseStatus(caseId, 'extraction_completed');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 503) {
        setGlobalError('OCR service unavailable. Please try again.');
        return;
      }
      setGlobalError(error instanceof ApiError ? error.message : 'Failed to process OCR');
    },
  });

  const saveCaseNotes = useMutation({
    mutationFn: (notes: string) => apiClient.patchCase(caseId, { notes }),
    onSuccess: (updatedCase) => {
      setNotesDraft(updatedCase.notes || '');
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to save case notes'),
  });

  const saveManualExtractionEdits = useMutation({
    mutationFn: (edits: Record<string, string>) => apiClient.patchCase(caseId, { manualExtractionEdits: edits }),
    onSuccess: (updatedCase) => {
      queryClient.setQueryData(['case', caseId], updatedCase);
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setGlobalError('');
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to save manual edits'),
  });

  const deleteCase = useMutation({
    mutationFn: (selectedCaseId: string) => apiClient.deleteCase(selectedCaseId),
    onMutate: (selectedCaseId) => {
      setDeletingCaseId(selectedCaseId);
      setGlobalError('');
    },
    onSuccess: (_result, deletedCaseId) => {
      queryClient.setQueryData(['cases'], (previous: Awaited<ReturnType<typeof apiClient.getCases>> | undefined) =>
        previous?.filter((item) => item.id !== deletedCaseId) ?? previous,
      );
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.removeQueries({ queryKey: ['case', deletedCaseId] });
      queryClient.removeQueries({ queryKey: ['evidence', deletedCaseId] });

      if (deletedCaseId === caseId) {
        reset();
        clearAllEvidenceBlobs();
        setExtractionData(undefined);
        setUploadMap({});
        setNotesDraft('');
      }
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to delete case'),
    onSettled: () => setDeletingCaseId(''),
  });

  useEffect(() => {
    setNotesDraft(caseQuery.data?.notes || '');
  }, [caseQuery.data?.notes]);

  const onSelectChannel = (selected: typeof channel) => {
    // Channel switch should always start a fresh case flow.
    setCase({ caseId: '', channel: selected });
    setStep(1);
    setGlobalError('');
    setExtractionData(undefined);
    setUploadMap({});
    setNotesDraft('');
  };

  const onStartNewFlow = () => {
    if (caseQuery.data) {
      const latestEvidence = evidenceQuery.data || caseQuery.data.evidence;
      const latestExtraction = extractionData || caseQuery.data.extraction;
      const latestStatus = latestExtraction
        ? 'extraction_completed'
        : latestEvidence.length > 0 && ['draft', 'case_created'].includes(caseQuery.data.status)
          ? 'evidence_uploaded'
          : caseQuery.data.status;
      const latestCase = mergeCaseRecords(caseQuery.data, {
        ...caseQuery.data,
        evidence: latestEvidence,
        extraction: latestExtraction,
        status: latestStatus,
      });

      queryClient.setQueryData(['case', caseQuery.data.id], latestCase);
      queryClient.setQueryData(['cases'], (previous: CaseRecord[] | undefined) => upsertCaseIntoCasesCache(previous, latestCase));
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    }

    reset();
    clearAllEvidenceBlobs();
    setGlobalError('');
    setExtractionData(undefined);
    setUploadMap({});
    setNotesDraft('');
    queryClient.removeQueries({ queryKey: ['case'] });
    queryClient.removeQueries({ queryKey: ['evidence'] });
  };

  const inferStepFromCase = (record: { status?: string; extraction?: unknown; evidence?: unknown[] }): WorkflowStep => {
    if (record.extraction) return 4;
    const status = (record.status || '').toLowerCase();
    if (status === 'extraction_completed') return 4;
    if (status === 'evidence_uploaded') return 3;
    if (status === 'location_saved') return 2;
    if (status === 'case_created' || status === 'draft') return 2;
    if (Array.isArray(record.evidence) && record.evidence.length > 0) return 3;
    return 2;
  };

  const onOpenRecentCase = (selectedCaseId: string) => {
    const selectedCase = (casesQuery.data || []).find((item) => item.id === selectedCaseId);
    if (!selectedCase) {
      setGlobalError('Selected case no longer exists in recent list. Please refresh and create a new case.');
      return;
    }

    setCase({ caseId: selectedCase.id, channel: selectedCase.channel });
    setStep(inferStepFromCase(selectedCase));
    setGlobalError('');
    setUploadMap({});
    setNotesDraft(selectedCase.notes || '');
    setExtractionData(selectedCase.extraction || undefined);
    queryClient.setQueryData(['case', selectedCase.id], selectedCase);
    queryClient.setQueryData(['evidence', selectedCase.id], selectedCase.evidence || []);
  };

  const onUpload = async (documentType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setUploadMap((prev) => ({
        ...prev,
        [documentType]: { ...(prev[documentType] || { notes: '', progress: 0 }), status: 'error', error: 'File exceeds 10MB limit.' },
      }));
      return;
    }
    if (!allowedMimeTypes.includes(file.type)) {
      setUploadMap((prev) => ({
        ...prev,
        [documentType]: {
          ...(prev[documentType] || { notes: '', progress: 0 }),
          status: 'error',
          error: 'Invalid file format. Use JPG, PNG, WEBP, or PDF.',
        },
      }));
      return;
    }

    setUploadMap((prev) => ({
      ...prev,
      [documentType]: {
        ...(prev[documentType] || { notes: '' }),
        status: 'uploading',
        progress: 0,
        error: undefined,
        lastFile: file,
      },
    }));

    try {
      await apiClient.uploadEvidence({
        caseId,
        documentType,
        file,
        notes: uploadMap[documentType]?.notes,
        onProgress: (percent) =>
          setUploadMap((prev) => ({
            ...prev,
            [documentType]: { ...(prev[documentType] || { notes: '' }), status: 'uploading', progress: percent, lastFile: file },
          })),
      });

      setUploadMap((prev) => ({
        ...prev,
        [documentType]: { ...(prev[documentType] || { notes: '' }), status: 'uploaded', progress: 100, error: undefined, lastFile: file },
      }));
      setGlobalError('');
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['evidence', caseId] });
      void apiClient.updateCaseStatus(caseId, 'evidence_uploaded');
    } catch (error) {
      setUploadMap((prev) => ({
        ...prev,
        [documentType]: {
          ...(prev[documentType] || { notes: '' }),
          status: 'error',
          progress: 0,
          error: error instanceof ApiError ? error.message : 'Upload failed.',
          lastFile: file,
        },
      }));
    }
  };

  const onRetryUpload = (documentType: string) => {
    const item = uploadMap[documentType];
    if (item?.lastFile) {
      void onUpload(documentType, item.lastFile);
    }
  };

  const uploadedCount = uploadItems.filter((item) => item.status === 'uploaded').length;
  const issueItems = uploadItems.filter((item) => item.status === 'error' || Boolean(item.error));
  const canAdvanceToOcr = uploadedCount > 0;
  const canGoBack = currentStep > 1;
  const summaryCaseData = useMemo(() => {
    const c = caseQuery.data;
    const ev = evidenceQuery.data;
    if (!c) return undefined;
    if (!ev?.length) return c;
    return mergeCaseRecords(c, { ...c, evidence: ev });
  }, [caseQuery.data, evidenceQuery.data]);

  const uploadedDocumentsForOcr = (() => {
    const evidence = summaryCaseData?.evidence || evidenceQuery.data || caseQuery.data?.evidence || [];
    if (!evidence.length) return uploadedCount;
    if (channel !== 'bale') return evidence.length;
    return new Set(evidence.map((item) => item.documentType)).size;
  })();

  const stepView: Record<WorkflowStep, React.ReactNode> = {
    1: (
      <CreateCaseStep
        selectedChannel={channel}
        loading={createCase.isPending}
        deletingCaseId={deletingCaseId}
        recentCases={casesQuery.data || []}
        onSelectChannel={onSelectChannel}
        onStart={() => createCase.mutate(channel)}
        onOpenCase={(selectedCaseId) => void onOpenRecentCase(selectedCaseId)}
        onDeleteCase={(selectedCaseId) => deleteCase.mutate(selectedCaseId)}
      />
    ),
    2: (
      <UploadDocumentsStep
        loading={false}
        items={uploadItems}
        allowedMimeTypes={allowedMimeTypes}
        onUpload={(documentType, file) => void onUpload(documentType, file)}
        onNoteChange={(documentType, notes) =>
          setUploadMap((prev) => ({
            ...prev,
            [documentType]: { ...(prev[documentType] || { status: 'empty', progress: 0 }), notes },
          }))
        }
        onRetry={onRetryUpload}
      />
    ),
    3: (
      <OcrProcessStep
        loading={startExtraction.isPending}
        documentCount={uploadedDocumentsForOcr}
        error={globalError || undefined}
        onStart={() => startExtraction.mutate()}
      />
    ),
    4: (
      <OcrResultStep
        extraction={extractionData || caseQuery.data?.extraction}
        loading={caseQuery.isLoading}
        persistedManualEdits={caseQuery.data?.manualExtractionEdits || {}}
        savingManualEdits={saveManualExtractionEdits.isPending}
        onSaveManualEdits={(edits) => saveManualExtractionEdits.mutate(edits)}
      />
    ),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-32 sm:px-6 lg:pb-8 lg:py-8">
      <div className="glass-card rounded-2xl border border-blue-200 bg-blue-50/90 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100">
        Data will be lost if server restarts
      </div>

      <header className="space-y-4 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <BtnLogo height={44} className="max-h-11" />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">OCR KPR Submission</p>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">Document Intelligence</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onStartNewFlow}
            className="shrink-0 self-start rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800 sm:self-center"
          >
            Restart from beginning
          </button>
        </div>
      </header>

      <Stepper currentStep={currentStep} />

      {globalError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">{globalError}</div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="glass-card min-h-[440px] p-5 transition-all duration-300">
          {canGoBack ? (
            <div className="mb-4 hidden lg:flex">
              <button
                type="button"
                onClick={() => setStep((currentStep - 1) as WorkflowStep)}
                className="inline-flex items-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800"
              >
                Back
              </button>
            </div>
          ) : null}
          {stepView[currentStep]}
        </div>
        <SummaryPanel
          caseId={caseId}
          channel={channel}
          caseData={summaryCaseData}
          extraction={extractionData || caseQuery.data?.extraction}
          loading={caseQuery.isLoading}
          notesDraft={notesDraft}
          notesSaving={saveCaseNotes.isPending}
          onNotesChange={setNotesDraft}
          onSaveNotes={() => saveCaseNotes.mutate(notesDraft)}
        />
      </section>
      {currentStep === 2 && assistantOpen ? (
        <div className="fixed bottom-24 right-4 z-20 w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-blue-200 bg-white p-4 shadow-xl dark:border-blue-900 dark:bg-slate-900 lg:bottom-24 lg:max-w-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">AI Upload Assistant</p>
            <button type="button" onClick={() => setAssistantOpen(false)} className="text-slate-500 dark:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {issueItems.length > 0 ? (
              issueItems.map((item) => (
                <p key={item.documentType} className="rounded-lg bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  {getDocumentLabel(item.documentType)}: {item.error || 'Upload issue detected.'}
                </p>
              ))
            ) : (
              <p className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                Great, no upload issue detected.
              </p>
            )}
            <div className="rounded-lg bg-blue-50 px-2 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <p>Accepted formats: JPG, PNG, WEBP, PDF</p>
              <p>Max size: 10MB</p>
              <p>Uploaded valid docs: {uploadedCount}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden items-center gap-3 lg:flex">
        {currentStep === 2 ? (
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={!canAdvanceToOcr}
            className="rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-blue-600"
          >
            Continue to OCR
          </button>
        ) : null}
      </div>

      <div
   className="fixed inset-x-0 bottom-0 z-10 border-t border-blue-100 bg-white/85 px-3 pt-3 backdrop-blur dark:border-blue-900 dark:bg-slate-950/80 lg:hidden"
   style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
 >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => canGoBack && setStep((currentStep - 1) as WorkflowStep)}
            disabled={!canGoBack}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentStep === 2 && canAdvanceToOcr) setStep(3);
              if (currentStep === 3 && extractionData) setStep(4);
            }}
            disabled={(currentStep === 2 && !canAdvanceToOcr) || (currentStep === 3 && !extractionData)}
            className="w-full rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-blue-600"
          >
            {currentStep === 2 ? 'Continue' : currentStep === 3 ? 'Result' : 'Continue'}
          </button>
        </div>
      </div>

      {currentStep === 2 ? (
        <button
          type="button"
          onClick={() => setAssistantOpen((prev) => !prev)}
          className={`fixed right-4 z-20 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition ${
            issueItems.length > 0 ? 'bottom-20 bg-red-600 hover:bg-red-500 lg:bottom-6' : 'bottom-20 bg-blue-700 hover:bg-blue-600 lg:bottom-6'
          }`}
        >
          {issueItems.length > 0 ? <CircleAlert className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          AI Helper{issueItems.length > 0 ? ` (${issueItems.length})` : ''}
        </button>
      ) : null}


    </main>
  );
}
