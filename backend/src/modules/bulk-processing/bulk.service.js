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

/**
 * Get job status and results.
 */
async function getJobStatus(jobId) {
  const job = await repository.findJobById(jobId);
  if (!job) {
    throw createHttpError(404, 'Bulk processing job not found');
  }
  return job;
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

  return {
    ...job,
    documents,
    nasabah,
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
  return repository.listJobs(limit);
}

module.exports = {
  handleBulkUpload,
  getJobStatus,
  getJobDetails,
  getPageOcrData,
  listJobs,
};
