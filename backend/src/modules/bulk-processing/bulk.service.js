/**
 * Bulk Processing Service
 *
 * Public API layer for bulk OCR processing.
 * Handles upload validation, ZIP extraction, and delegates to orchestrator.
 */

const { createHttpError } = require('../../utils/httpError');
const repository = require('./bulk.repository');
const { createAndProcessJob } = require('./bulk-orchestrator.service');
const { extractZipBuffer } = require('./zip-extractor');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total
const UNIDENTIFIED_FULL_NAME = 'Unidentified';

/**
 * Handle bulk upload (ZIP or multiple files).
 * @param {Array<{ buffer: Buffer, originalname: string, mimetype: string, size: number }>} files
 * @returns {{ jobId: string, status: string }}
 */
async function handleBulkUpload(files) {
  if (!files || files.length === 0) {
    throw createHttpError(400, 'At least one file is required');
  }

  // Check total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    throw createHttpError(400, `Total upload size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit`);
  }

  // Determine upload type
  const hasZip = files.some((f) => isZipFile(f));

  if (hasZip) {
    return handleZipUpload(files);
  }

  return handleMultiFileUpload(files);
}

/**
 * Handle ZIP upload - extract and process all contained files.
 */
async function handleZipUpload(files) {
  const zipFile = files.find((f) => isZipFile(f));
  if (!zipFile) {
    throw createHttpError(400, 'No valid ZIP file found');
  }

  const extractedFiles = extractZip(zipFile.buffer);

  if (extractedFiles.length === 0) {
    throw createHttpError(400, 'ZIP file contains no processable PDF or image files');
  }

  return createAndProcessJob({
    files: extractedFiles,
    uploadType: 'zip',
  });
}

/**
 * Handle multiple file upload (bulk PDFs/images).
 */
async function handleMultiFileUpload(files) {
  const validFiles = files.filter((f) => isProcessableFile(f));

  if (validFiles.length === 0) {
    throw createHttpError(400, 'No processable PDF or image files found. Supported: PDF, JPEG, PNG, WEBP, TIFF');
  }

  return createAndProcessJob({
    files: validFiles,
    uploadType: 'bulk_files',
  });
}

/**
 * Extract files from a ZIP buffer.
 */
function extractZip(buffer) {
  let entries;
  try {
    entries = extractZipBuffer(buffer);
  } catch (error) {
    throw createHttpError(400, 'Failed to read ZIP file. File may be corrupted.', { detail: error.message });
  }

  const extracted = [];

  for (const entry of entries) {
    const name = entry.filename;
    // Skip hidden files and macOS metadata
    if (name.startsWith('__MACOSX') || name.startsWith('.')) continue;

    const ext = name.split('.').pop()?.toLowerCase();
    const mimetype = getMimeFromExtension(ext);

    if (!mimetype || !ALLOWED_MIME_TYPES.has(mimetype)) continue;

    const fileBuffer = entry.buffer;
    if (!fileBuffer || fileBuffer.length === 0) continue;
    if (fileBuffer.length > MAX_FILE_SIZE) continue;

    extracted.push({
      buffer: fileBuffer,
      originalname: name.split('/').pop() || name,
      mimetype,
      size: fileBuffer.length,
    });
  }

  return extracted;
}

function isZipFile(file) {
  return ZIP_MIME_TYPES.has(file.mimetype) ||
    file.originalname.toLowerCase().endsWith('.zip');
}

function isProcessableFile(file) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) return true;
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const mime = getMimeFromExtension(ext);
  return mime && ALLOWED_MIME_TYPES.has(mime);
}

function getMimeFromExtension(ext) {
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };
  return map[ext] || null;
}

function normalizeUploadType(uploadType) {
  return uploadType === 'bulk_files' ? 'files' : uploadType;
}

function isUnidentifiedNasabah(record) {
  return (record.fullName || '').trim() === UNIDENTIFIED_FULL_NAME;
}

function normalizeJob(job) {
  const result = job.result || {};

  return {
    id: job.id,
    status: job.status,
    uploadType: normalizeUploadType(job.uploadType),
    totalFiles: result.totalFiles ?? job.totalFiles ?? 0,
    totalPages: result.totalPages ?? job.totalPages ?? 0,
    processedPages: result.processedPages ?? job.processedPages ?? 0,
    failedPages: result.failedPages ?? 0,
    batchCount: job.batchCount ?? 0,
    batchSize: job.batchSize ?? 0,
    createdAt: job.createdAt,
    completedAt: job.completedAt || undefined,
  };
}

function normalizeDocument(doc) {
  const extractedFields = doc.extractedFields && typeof doc.extractedFields === 'object'
    ? doc.extractedFields
    : {};

  return {
    id: doc.id,
    jobId: doc.jobId,
    nasabahId: doc.nasabahId || '',
    documentType: doc.documentType,
    filename: doc.sourceFilename,
    pageCount: Array.isArray(doc.pageIds) ? doc.pageIds.length : 0,
    confidence: doc.confidence ?? 0,
    fields: Object.entries(extractedFields).map(([key, value]) => ({
      key,
      value: value == null ? '' : String(value),
      confidence: doc.confidence ?? 0,
    })),
  };
}

function normalizeNasabahRecord(record) {
  const completeness = record.completeness && typeof record.completeness === 'object'
    ? record.completeness
    : {};
  const fullName = record.fullName || '';
  const nik = record.nik || '';

  return {
    id: record.id,
    fullName,
    nik,
    documentCount: record.documentCount ?? (Array.isArray(record.documentIds) ? record.documentIds.length : 0),
    completenessScore: record.completenessScore ?? 0,
    missing: Array.isArray(record.missing)
      ? record.missing
      : (Array.isArray(completeness.missing) ? completeness.missing : []),
    warnings: Array.isArray(record.warnings)
      ? record.warnings
      : (Array.isArray(completeness.warnings) ? completeness.warnings : []),
  };
}

function normalizeResultSummary(job, normalizedJob, documents, nasabah) {
  const result = job.result && typeof job.result === 'object' ? job.result : {};
  const normalizedNasabah = Array.isArray(result.nasabah) && result.nasabah.length > 0
    ? result.nasabah.map(normalizeNasabahRecord)
    : nasabah;
  const visibleNasabah = normalizedNasabah.filter((record) => !isUnidentifiedNasabah(record));
  const unidentifiedNasabahIds = new Set(
    normalizedNasabah
      .filter((record) => isUnidentifiedNasabah(record))
      .map((record) => record.id)
  );

  return {
    totalFiles: result.totalFiles ?? normalizedJob.totalFiles ?? 0,
    totalPages: result.totalPages ?? normalizedJob.totalPages ?? 0,
    processedPages: result.processedPages ?? normalizedJob.processedPages ?? 0,
    failedPages: result.failedPages ?? 0,
    totalDocuments: result.totalDocuments ?? documents.length,
    totalNasabah: visibleNasabah.length,
    unidentifiedDocuments: result.unidentifiedDocuments
      ?? documents.filter((doc) => !doc.nasabahId || unidentifiedNasabahIds.has(doc.nasabahId)).length,
    nasabah: visibleNasabah,
  };
}

/**
 * Get job status and results.
 */
async function getJobStatus(jobId) {
  const job = await repository.findJobById(jobId);
  if (!job) {
    throw createHttpError(404, 'Bulk processing job not found');
  }
  return normalizeJob(job);
}

/**
 * Get full job details including documents and nasabah.
 */
async function getJobDetails(jobId) {
  const job = await repository.findJobById(jobId);
  if (!job) {
    throw createHttpError(404, 'Bulk processing job not found');
  }

  const [documents, nasabah, pages] = await Promise.all([
    repository.getDocumentsByJob(jobId),
    repository.getNasabahByJob(jobId),
    repository.getPagesByJob(jobId),
  ]);

  const normalizedDocuments = documents.map(normalizeDocument);
  const normalizedNasabah = nasabah.map(normalizeNasabahRecord);
  const normalizedJob = normalizeJob(job);
  const result = normalizeResultSummary(job, normalizedJob, normalizedDocuments, normalizedNasabah);

  return {
    ...normalizedJob,
    result,
    documents: normalizedDocuments,
    nasabah: result.nasabah,
    pages: pages.map((p) => ({
      id: p.id,
      sourceFilename: p.sourceFilename,
      pageNumber: p.pageNumber,
      batchIndex: p.batchIndex,
      status: p.status,
      ocrConfidence: p.ocrConfidence,
      // Exclude full OCR text from listing (can be fetched per-page)
    })),
  };
}

/**
 * Get a single page's full OCR data.
 */
async function getPageOcrData(jobId, pageId) {
  const pages = await repository.getPagesByJob(jobId);
  const page = pages.find((p) => p.id === pageId);
  if (!page) {
    throw createHttpError(404, 'Page not found');
  }
  return page;
}

/**
 * List all jobs (recent first).
 */
async function listJobs(limit) {
  const jobs = await repository.listJobs(limit);
  return jobs.map(normalizeJob);
}

/**
 * Delete a job and all associated data.
 */
async function deleteJob(jobId) {
  const job = await repository.findJobById(jobId);
  if (!job) {
    throw createHttpError(404, 'Bulk processing job not found');
  }
  await repository.deleteJob(jobId);
}

async function deleteNasabah(nasabahId) {
  await repository.deleteNasabah(nasabahId);
}

module.exports = {
  handleBulkUpload,
  getJobStatus,
  getJobDetails,
  getPageOcrData,
  listJobs,
  deleteJob,
  deleteNasabah,
};
