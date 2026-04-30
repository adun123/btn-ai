'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bot, CircleAlert, X } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api';
import { docsByChannel } from '../../lib/workflow';
import { useWorkflowStore } from '../../store/workflow-store';
import type { ExtractionResult, WorkflowStep } from '../../types/ocr';
import { SummaryPanel } from './summary-panel';
import { Stepper } from './stepper';
import { CreateCaseStep } from './steps/create-case-step';
import { LocationStep } from './steps/location-step';
import { OcrProcessStep } from './steps/ocr-process-step';
import { OcrResultStep } from './steps/ocr-result-step';
import { UploadDocumentsStep } from './steps/upload-documents-step';

type UploadState = {
  status: 'empty' | 'uploaded' | 'error' | 'uploading';
  notes: string;
  progress: number;
  lastFile?: File;
  error?: string;
};

export function OcrWorkflowPage() {
  const queryClient = useQueryClient();
  const { caseId, channel, currentStep, setCase, setStep } = useWorkflowStore();
  const [globalError, setGlobalError] = useState<string>('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [rawAddressText, setRawAddressText] = useState('');
  const [extractionData, setExtractionData] = useState<ExtractionResult | undefined>(undefined);
  const [uploadMap, setUploadMap] = useState<Record<string, UploadState>>({});
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const docTypes = docsByChannel[channel];

  const uploadItems = useMemo(
    () =>
      docTypes.map((documentType) => ({
        documentType,
        ...(uploadMap[documentType] || { status: 'empty', notes: '', progress: 0 }),
      })),
    [docTypes, uploadMap],
  );

  const caseQuery = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiClient.getCase(caseId),
    enabled: Boolean(caseId),
  });

  const createCase = useMutation({
    mutationFn: apiClient.createCase,
    onSuccess: (nextCase) => {
      setCase({ caseId: nextCase.id, channel: nextCase.channel });
      setStep(2);
      setGlobalError('');
      queryClient.invalidateQueries({ queryKey: ['case', nextCase.id] });
      setUploadMap({});
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to create case'),
  });

  const saveLocation = useMutation({
    mutationFn: () => apiClient.saveLocation(caseId, rawAddressText),
    onSuccess: () => {
      setStep(3);
      setGlobalError('');
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
    onError: (error) => setGlobalError(error instanceof ApiError ? error.message : 'Failed to save location'),
  });

  const startExtraction = useMutation({
    mutationFn: async () => {
      await apiClient.startExtraction(caseId);
      return apiClient.getExtraction(caseId);
    },
    onSuccess: (payload) => {
      setExtractionData(payload);
      setStep(5);
      setGlobalError('');
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 503) {
        setGlobalError('OCR service unavailable. Please try again.');
        return;
      }
      setGlobalError(error instanceof ApiError ? error.message : 'Failed to process OCR');
    },
  });

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

  const stepView: Record<WorkflowStep, React.ReactNode> = {
    1: (
      <CreateCaseStep
        selectedChannel={channel}
        loading={createCase.isPending}
        onSelectChannel={(selected) => setCase({ caseId, channel: selected })}
        onStart={() => createCase.mutate(channel)}
      />
    ),
    2: (
      <LocationStep
        value={rawAddressText}
        loading={saveLocation.isPending}
        onChange={setRawAddressText}
        onSubmit={() => saveLocation.mutate()}
      />
    ),
    3: (
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
    4: (
      <OcrProcessStep
        loading={startExtraction.isPending}
        documentCount={caseQuery.data?.evidence.length || uploadedCount}
        error={globalError || undefined}
        onStart={() => startExtraction.mutate()}
      />
    ),
    5: <OcrResultStep extraction={extractionData || caseQuery.data?.extraction} loading={caseQuery.isLoading} />,
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-32 sm:px-6 lg:pb-8 lg:py-8">
      <div className="glass-card rounded-2xl border border-blue-200 bg-blue-50/90 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100">
        Data will be lost if server restarts
      </div>

      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">OCR KPR Submission</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">Modern case-based workflow</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Connected to <span className="font-medium">{apiClient.backendUrl}</span></p>
      </header>

      <Stepper currentStep={currentStep} />

      {globalError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">{globalError}</div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="glass-card min-h-[440px] p-5 transition-all duration-300">{stepView[currentStep]}</div>
        <SummaryPanel
          caseId={caseId}
          channel={channel}
          caseData={caseQuery.data}
          extraction={extractionData || caseQuery.data?.extraction}
          loading={caseQuery.isLoading}
        />
      </section>
      {currentStep === 3 && assistantOpen ? (
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
                  {item.documentType}: {item.error || 'Upload issue detected.'}
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
        <button
          type="button"
          onClick={() => canGoBack && setStep((currentStep - 1) as WorkflowStep)}
          disabled={!canGoBack}
          className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200"
        >
          Back
        </button>
        {currentStep === 3 ? (
          <button
            type="button"
            onClick={() => setStep(4)}
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
              if (currentStep === 3 && canAdvanceToOcr) setStep(4);
              if (currentStep === 4 && extractionData) setStep(5);
            }}
            disabled={(currentStep === 3 && !canAdvanceToOcr) || (currentStep === 4 && !extractionData)}
            className="w-full rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-blue-600"
          >
            {currentStep === 3 ? 'Continue' : currentStep === 4 ? 'Result' : 'Continue'}
          </button>
        </div>
      </div>

      {currentStep === 3 ? (
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
