export type Channel = 'branch' | 'bale';

export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type ApiErrorShape = {
  success: false;
  error: string;
  details?: unknown;
};

export type CaseRecord = {
  id: string;
  channel: Channel;
  status: string;
  notes?: string;
  manualExtractionEdits?: Record<string, string>;
  evidence: Array<{
    id: string;
    documentType: string;
    filename: string;
    mimetype: string;
    size: number;
    notes: string;
    uploadedAt: string;
  }>;
  extraction?: ExtractionResult;
  updatedAt: string;
};

export type EvidenceItem = CaseRecord['evidence'][number];

export type ExtractionField = {
  key: string;
  value: string | null;
  confidence: number;
  source: string;
  reviewRequired: boolean;
  notes?: string | null;
};

export type ExtractedDocument = {
  evidenceId: string;
  filename: string;
  documentType: string;
  confidence: number;
  summary: string;
  fields: ExtractionField[];
  warnings: string[];
};

export type ExtractionResult = {
  channel: Channel;
  status: string;
  pipeline: string;
  generatedAt: string;
  summary: string;
  documents?: ExtractedDocument[];
  fields: ExtractionField[];
  warnings: string[];
};
