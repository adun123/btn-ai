'use client';

import { useCallback, useState } from 'react';
import { BackendStatus } from '../components/backend-status';
import styles from './page.module.css';

const defaultBackendUrl = 'http://localhost:4000';
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim() || defaultBackendUrl;

const createCasePayload = {
  channel: 'bale',
  applicant: { fullName: 'Frontend OCR Test User' },
  property: { propertyType: 'house' },
};

const documentTypeOptions = ['ktp', 'kk', 'slip_gaji'] as const;

type DocumentType = (typeof documentTypeOptions)[number];
type PendingAction = 'create-case' | 'upload-evidence' | 'start-extraction' | null;
type MessageTone = 'info' | 'success' | 'error';
type UiMessage = {
  id: number;
  tone: MessageTone;
  text: string;
};

class ApiRequestError extends Error {
  payload: unknown;

  constructor(message: string, payload: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.payload = payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  return null;
}

function getCaseId(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.id !== 'string') {
    return null;
  }

  return payload.data.id;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { error: text } : null;
}

async function requestBackend(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    cache: 'no-store',
  });

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new ApiRequestError(getErrorMessage(payload) || `${response.status} ${response.statusText}`, payload);
  }

  return payload;
}

export default function HomePage() {
  const [caseId, setCaseId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('ktp');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasUploadedEvidence, setHasUploadedEvidence] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [backendPhase, setBackendPhase] = useState<'checking' | 'ok' | 'error'>('checking');
  const [backendMessage, setBackendMessage] = useState('Checking backend availability...');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [latestResponseLabel, setLatestResponseLabel] = useState('No backend requests yet.');
  const [latestResponse, setLatestResponse] = useState<unknown>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 1,
      tone: 'info',
      text: 'Create a Bale case first. The returned caseId is required for upload and OCR.',
    },
  ]);

  const latestResponseJson = latestResponse === null ? 'No backend response yet.' : JSON.stringify(latestResponse, null, 2);
  const isBusy = pendingAction !== null;
  const backendUnavailable = backendPhase !== 'ok';

  const handleBackendPhaseChange = useCallback((phase: 'checking' | 'ok' | 'error', message: string) => {
    setBackendPhase(phase);
    setBackendMessage(message);
  }, []);

  const pushMessage = (tone: MessageTone, text: string) => {
    setMessages((current) => [{ id: Date.now(), tone, text }, ...current].slice(0, 6));
  };

  const handleRequestError = (label: string, error: unknown) => {
    setLatestResponseLabel(label);

    if (error instanceof ApiRequestError) {
      setLatestResponse(error.payload ?? { error: error.message });
      pushMessage('error', error.message);
      return;
    }

    const fallbackMessage = error instanceof Error ? error.message : 'Unexpected request failure.';
    setLatestResponse({ error: fallbackMessage });
    pushMessage('error', fallbackMessage);
  };

  const handleCreateCase = async () => {
    if (backendUnavailable) {
      pushMessage('error', `Backend is not reachable at ${backendUrl}. Check NEXT_PUBLIC_BACKEND_URL and make sure the API server is running.`);
      return;
    }

    const label = 'POST /cases';
    setPendingAction('create-case');
    setLatestResponseLabel(label);
    pushMessage('info', 'Creating a new Bale case...');

    try {
      const payload = await requestBackend('/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createCasePayload),
      });

      const nextCaseId = getCaseId(payload);

      if (!nextCaseId) {
        throw new Error('Backend response did not include data.id for the new case.');
      }

      setCaseId(nextCaseId);
      setHasUploadedEvidence(false);
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setLatestResponse(payload);
      pushMessage('success', `Case created. Use caseId ${nextCaseId} for upload and OCR.`);
    } catch (error) {
      handleRequestError(label, error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleUploadEvidence = async () => {
    if (backendUnavailable) {
      pushMessage('error', `Backend is not reachable at ${backendUrl}. Check NEXT_PUBLIC_BACKEND_URL and make sure the API server is running.`);
      return;
    }

    if (!caseId.trim() || !selectedFile) {
      return;
    }

    const normalizedCaseId = caseId.trim();
    const label = `POST /cases/${normalizedCaseId}/evidence`;
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('files', selectedFile);

    setPendingAction('upload-evidence');
    setLatestResponseLabel(label);
    pushMessage('info', `Uploading ${selectedFile.name} as ${documentType}...`);

    try {
      const payload = await requestBackend(`/cases/${encodeURIComponent(normalizedCaseId)}/evidence`, {
        method: 'POST',
        body: formData,
      });

      setLatestResponse(payload);
      setHasUploadedEvidence(true);
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      pushMessage('success', `Uploaded ${selectedFile.name} as ${documentType}.`);
    } catch (error) {
      handleRequestError(label, error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartExtraction = async () => {
    if (backendUnavailable) {
      pushMessage('error', `Backend is not reachable at ${backendUrl}. Check NEXT_PUBLIC_BACKEND_URL and make sure the API server is running.`);
      return;
    }

    if (!caseId.trim()) {
      return;
    }

    const normalizedCaseId = caseId.trim();
    const startLabel = `POST /cases/${normalizedCaseId}/extraction/start`;
    const readLabel = `GET /cases/${normalizedCaseId}/extraction`;
    let activeLabel = startLabel;

    setPendingAction('start-extraction');
    setLatestResponseLabel(startLabel);
    pushMessage('info', `Starting OCR extraction for caseId ${normalizedCaseId}...`);

    try {
      const startPayload = await requestBackend(`/cases/${encodeURIComponent(normalizedCaseId)}/extraction/start`, {
        method: 'POST',
      });

      setLatestResponse(startPayload);
      setLatestResponseLabel(readLabel);
      activeLabel = readLabel;

      const latestExtraction = await requestBackend(`/cases/${encodeURIComponent(normalizedCaseId)}/extraction`);

      setLatestResponse(latestExtraction);
      pushMessage('success', `OCR extraction completed for caseId ${normalizedCaseId}.`);
    } catch (error) {
      handleRequestError(activeLabel, error);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>developer test page</p>
        <h1 className={styles.title}>BTN Bale OCR Frontend Check</h1>
        <p className={styles.summary}>
          This page stays intentionally small. It exposes the current backend URL, creates one Bale case,
          uploads one document, starts OCR, and shows the raw backend JSON directly for quick testing.
        </p>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Backend and case</h2>
          <p className={styles.cardText}>
            The frontend reads <code className={styles.inlineCode}>NEXT_PUBLIC_BACKEND_URL</code> and falls back to{' '}
            <code className={styles.inlineCode}>{defaultBackendUrl}</code>.
          </p>

          <div className={styles.stack}>
            <p className={styles.metaLabel}>Resolved backend URL</p>
            <code className={styles.codeBlock}>{backendUrl}</code>
            <p className={styles.metaLabel}>Backend status gate</p>
            <code className={styles.codeBlock}>{backendPhase}: {backendMessage}</code>
            <p className={styles.metaLabel}>Create case payload</p>
            <code className={styles.codeBlock}>{JSON.stringify(createCasePayload)}</code>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="caseId">
              Current caseId
            </label>
            <input
              id="caseId"
              className={styles.textInput}
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              placeholder="Created caseId will appear here"
            />
          </div>

          <p className={styles.hint}>
            This value comes from <code className={styles.inlineCode}>POST /cases</code> as <code className={styles.inlineCode}>data.id</code>.
            The same caseId is required for evidence upload and OCR extraction.
          </p>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleCreateCase}
              disabled={isBusy || backendUnavailable}
            >
              {pendingAction === 'create-case' ? 'Creating Bale case...' : 'Create Bale case'}
            </button>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Upload and extract</h2>
          <p className={styles.cardText}>
            Upload one Bale document only. Supported <code className={styles.inlineCode}>documentType</code> values are{' '}
            <code className={styles.inlineCode}>ktp</code>, <code className={styles.inlineCode}>kk</code>, and{' '}
            <code className={styles.inlineCode}>slip_gaji</code>.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="documentType">
              Document type
            </label>
            <select
              id="documentType"
              className={styles.selectInput}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
              disabled={isBusy}
            >
              {documentTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="documentFile">
              Document file
            </label>
            <input
              key={fileInputKey}
              id="documentFile"
              className={styles.fileInput}
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              disabled={isBusy}
            />
          </div>

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleUploadEvidence}
              disabled={isBusy || backendUnavailable || !caseId.trim() || !selectedFile}
            >
              {pendingAction === 'upload-evidence' ? 'Uploading...' : 'Upload document'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleStartExtraction}
              disabled={isBusy || backendUnavailable || !caseId.trim() || !hasUploadedEvidence}
            >
              {pendingAction === 'start-extraction' ? 'Running OCR...' : 'Start OCR extraction'}
            </button>
          </div>

          <p className={styles.hint}>
            The OCR button calls <code className={styles.inlineCode}>POST /cases/:caseId/extraction/start</code> and then reads{' '}
            <code className={styles.inlineCode}>GET /cases/:caseId/extraction</code>.
          </p>
          {!hasUploadedEvidence ? (
            <p className={styles.hint}>
              Upload one Bale document successfully first. OCR stays disabled until the backend confirms evidence is attached to this case.
            </p>
          ) : null}
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Important messages</h2>
          <p className={styles.cardText}>Backend success and error messages are surfaced here without rewriting them.</p>

          <ul className={styles.messageList} aria-live="polite">
            {messages.map((message) => (
              <li key={message.id} className={`${styles.messageItem} ${styles[`message${message.tone}`]}`}>
                <div className={styles.messageHeader}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  <span className={styles.messageTone}>{message.tone}</span>
                </div>
                <p className={styles.messageText}>{message.text}</p>
              </li>
            ))}
          </ul>
        </article>

        <BackendStatus
          backendUrl={backendUrl}
          onPhaseChange={handleBackendPhaseChange}
        />

        <article className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>Latest backend JSON</h2>
          <p className={styles.metaLabel}>{latestResponseLabel}</p>
          <pre className={styles.jsonBlock}>{latestResponseJson}</pre>
        </article>
      </section>
    </main>
  );
}
