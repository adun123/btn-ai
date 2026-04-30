'use client';

import { useEffect, useState } from 'react';
import styles from './backend-status.module.css';

type BackendStatusProps = {
  backendUrl: string;
  onPhaseChange?: (phase: StatusState['phase'], message: string) => void;
};

type StatusState =
  | { phase: 'checking'; message: string }
  | { phase: 'ok'; message: string; service: string; timestamp: string }
  | { phase: 'error'; message: string };

export function BackendStatus({ backendUrl, onPhaseChange }: BackendStatusProps) {
  const [status, setStatus] = useState<StatusState>({
    phase: 'checking',
    message: 'Checking backend availability...',
  });

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);

    setStatus({
      phase: 'checking',
      message: 'Checking backend availability...',
    });
    onPhaseChange?.('checking', 'Checking backend availability...');

    const run = async () => {
      try {
        const normalizedBase = backendUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
        const response = await fetch(`${normalizedBase}/api/health`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`);
        }

        const payload = (await response.json()) as {
          data?: { status?: string; service?: string; timestamp?: string };
        };

        setStatus({
          phase: 'ok',
          message: payload.data?.status || 'ok',
          service: payload.data?.service || 'backend available',
          timestamp: payload.data?.timestamp || 'timestamp unavailable',
        });
        onPhaseChange?.('ok', payload.data?.status || 'ok');
      } catch (error) {
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'Health check timed out.'
          : error instanceof Error
            ? error.message
            : 'Backend unavailable.';

        setStatus({
          phase: 'error',
          message,
        });
        onPhaseChange?.('error', message);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void run();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [backendUrl, onPhaseChange]);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Backend status check</h2>
        <span className={`${styles.badge} ${styles[status.phase]}`}>{status.phase}</span>
      </div>

      <p className={styles.message}>{status.message}</p>

      {status.phase === 'ok' ? (
        <dl className={styles.metaList}>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>service</dt>
            <dd className={styles.metaValue}>{status.service}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>timestamp</dt>
            <dd className={styles.metaValue}>{status.timestamp}</dd>
          </div>
        </dl>
      ) : null}

      <p className={styles.note}>Checks <code className={styles.inlineCode}>{backendUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/health</code> after the page loads.</p>
    </article>
  );
}
