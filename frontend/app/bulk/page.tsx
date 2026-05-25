'use client';

import { useState } from 'react';
import { BulkUploadStep } from '../../components/bulk/bulk-upload-step';
import { BulkResultStep } from '../../components/bulk/bulk-result-step';

export default function BulkPage() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Bulk Document Processing</h1>
        <p className="text-muted text-sm">Upload dokumen banyak nasabah sekaligus — otomatis dikelompokkan dan dicek kelengkapannya</p>
      </header>

      {jobId ? (
        <BulkResultStep jobId={jobId} onReset={() => setJobId(null)} />
      ) : (
        <BulkUploadStep onComplete={setJobId} />
      )}
    </main>
  );
}
