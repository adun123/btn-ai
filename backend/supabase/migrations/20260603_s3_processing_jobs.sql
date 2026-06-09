-- Migration: Add S3 support and processing jobs
-- Date: 2026-06-03

-- Add S3 columns to evidence_documents table
ALTER TABLE evidence_documents
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS s3_url TEXT;

-- Create processing_jobs table for async job tracking
CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  case_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Create index on case_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_processing_jobs_case_id ON processing_jobs(case_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- Create index on s3_key for evidence_documents
CREATE INDEX IF NOT EXISTS idx_evidence_documents_s3_key ON evidence_documents(s3_key) WHERE s3_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE processing_jobs IS 'Async processing jobs for OCR extraction';
COMMENT ON COLUMN processing_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN processing_jobs.result IS 'Job result containing extraction and case data when completed';
COMMENT ON COLUMN processing_jobs.error IS 'Error message when job fails';
