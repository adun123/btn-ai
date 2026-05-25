export type BulkJobStatus =
  | 'pending'
  | 'extracting'
  | 'ocr_processing'
  | 'classifying'
  | 'grouping'
  | 'completed'
  | 'failed';

export type BulkJob = {
  id: string;
  status: BulkJobStatus;
  uploadType: 'zip' | 'files';
  totalFiles: number;
  totalPages: number;
  processedPages: number;
  failedPages: number;
  batchCount: number;
  batchSize: number;
  createdAt: string;
  completedAt?: string;
};

export type BulkNasabah = {
  id: string;
  fullName: string;
  nik: string;
  documentCount: number;
  completenessScore: number;
  missing: string[];
  warnings: string[];
};

export type BulkDocumentField = {
  key: string;
  value: string;
  confidence: number;
};

export type BulkDocument = {
  id: string;
  jobId: string;
  nasabahId: string;
  documentType: string;
  filename: string;
  pageCount: number;
  confidence: number;
  fields?: BulkDocumentField[];
};

export type BulkJobDetails = BulkJob & {
  result: {
    totalFiles: number;
    totalPages: number;
    processedPages: number;
    failedPages: number;
    totalDocuments: number;
    totalNasabah: number;
    unidentifiedDocuments: number;
    nasabah: BulkNasabah[];
  };
  documents: BulkDocument[];
  nasabah: BulkNasabah[];
};
