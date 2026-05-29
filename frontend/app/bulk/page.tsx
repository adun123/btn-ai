'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BulkUploadStep } from '../../components/bulk/bulk-upload-step';
import { BulkResultStep } from '../../components/bulk/bulk-result-step';

function BulkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');

  const setJobId = (id: string) => {
    router.replace(`/bulk?jobId=${id}`);
  };

  const clearJobId = () => {
    router.replace('/bulk');
  };

  return (
    <>
      {jobId ? (
        <BulkResultStep jobId={jobId} onReset={clearJobId} />
      ) : (
        <BulkUploadStep onComplete={setJobId} onViewResult={setJobId} />
      )}
    </>
  );
}

export default function BulkPage() {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Bulk Document Processing</h1>
        <p className="text-muted text-sm">Upload dokumen banyak nasabah sekaligus — otomatis dikelompokkan dan dicek kelengkapannya</p>
      </header>

      <Suspense fallback={<div className="text-center text-muted">Loading...</div>}>
        <BulkContent />
      </Suspense>
    </main>
  );
}
