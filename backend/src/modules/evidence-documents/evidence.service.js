const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const caseService = require('../assessment-core/case.service');
const repository = require('./evidence.repository');
const { getUploadUrl, generateS3Key } = require('../storage/s3.service');

const branchDocumentTypes = new Set(['application_form', 'supporting_document', 'salary_slip', 'other']);
const baleDocumentTypes = new Set(['ktp', 'kk', 'slip_gaji', 'npwp', 'rekening_koran']);

const upload = multer({
  // Memory storage lets the OCR path read the file buffer immediately before persisting it as base64.
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function parseClientCaseFromBody(body) {
  let clientCase = body?.clientCase;
  if (typeof clientCase === 'string') {
    try {
      clientCase = JSON.parse(clientCase);
    } catch {
      clientCase = undefined;
    }
  }
  return clientCase;
}

async function getPresignedUrl(caseId, body) {
  const { filename, contentType, documentType, size, notes } = body;

  if (!filename || !contentType || !documentType) {
    throw createHttpError(400, 'Missing required fields: filename, contentType, documentType');
  }

  // Validate case exists and channel
  const record = await caseService.getCase(caseId);
  const normalizedDocType = normalizeDocumentType(documentType);
  validateDocumentType(record.channel, normalizedDocType);

  // Generate S3 key and presigned URL
  const s3Key = generateS3Key(caseId, filename);
  const uploadUrl = await getUploadUrl(s3Key, contentType);

  // Generate evidence ID for later confirmation
  const evidenceId = randomUUID();

  return {
    uploadUrl,
    key: s3Key,
    evidenceId,
  };
}

async function confirmS3Upload(caseId, body) {
  const { evidenceId, key } = body;

  if (!evidenceId || !key) {
    throw createHttpError(400, 'Missing required fields: evidenceId, key');
  }

  // Get the case to validate
  const record = await caseService.getCase(caseId);

  // Parse the key to get the original filename and document type
  // Key format: cases/{caseId}/{timestamp}-{random}-{filename}
  const keyParts = key.split('/');
  const filenamePart = keyParts[keyParts.length - 1];

  // Extract filename from key (remove timestamp and random suffix)
  const match = filenamePart.match(/^\d+-[a-z0-9]+-(.+)$/);
  const filename = match ? match[1] : filenamePart;

  // Get document type and notes from request body if provided
  const documentType = normalizeDocumentType(body.documentType || 'unknown');
  const notes = body.notes || '';
  const size = body.size || 0;

  // Infer contentType from filename extension if not provided
  let contentType = body.contentType;
  if (!contentType) {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': contentType = 'application/pdf'; break;
      case 'jpg':
      case 'jpeg': contentType = 'image/jpeg'; break;
      case 'png': contentType = 'image/png'; break;
      case 'tiff': contentType = 'image/tiff'; break;
      case 'webp': contentType = 'image/webp'; break;
      default: contentType = 'application/octet-stream';
    }
  }

  // Create evidence record with S3 key
  const timestamp = nowIso();
  const item = {
    id: evidenceId,
    documentType,
    filename,
    mimetype: contentType,
    size,
    notes,
    uploadedAt: timestamp,
    s3Key: key,
  };

  const uploaded = await repository.insertEvidenceWithS3Key(caseId, [item]);

  // Update case with new evidence
  record.evidence.push(uploaded[0]);
  record.auditTrail.push({
    action: 'evidence_uploaded',
    timestamp,
    payload: {
      documentType,
      files: uploaded.map((item) => ({ id: item.id, filename: item.filename })),
    },
  });
  record.updatedAt = timestamp;
  const savedCase = await caseService.saveCaseRecord(record);

  return {
    case: savedCase,
    uploaded,
  };
}

async function addEvidence(caseId, files, body) {
  const record = await caseService.getCase(caseId, parseClientCaseFromBody(body || {}));
  if (!files || files.length === 0) {
    throw createHttpError(400, 'At least one file is required');
  }

  const timestamp = nowIso();
  const documentType = normalizeDocumentType(body?.documentType);
  const notes = body?.notes || '';

  validateDocumentType(record.channel, documentType);

  const items = files.map((file) => ({
    id: randomUUID(),
    documentType,
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    notes,
    uploadedAt: timestamp,
  }));

  const uploaded = await repository.insertEvidence(caseId, items, files);
  record.auditTrail.push({
    action: 'evidence_uploaded',
    timestamp,
    payload: {
      documentType,
      files: uploaded.map((item) => ({ id: item.id, filename: item.filename })),
    },
  });
  record.updatedAt = timestamp;
  const savedCase = await caseService.saveCaseRecord(record);

  return {
    case: savedCase,
    uploaded,
  };
}

function normalizeDocumentType(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function validateDocumentType(channel, documentType) {
  // Each intake channel has a different document taxonomy, so validation happens after the case is loaded.
  if (channel === 'bale' && !baleDocumentTypes.has(documentType)) {
    throw createHttpError(400, 'For bale channel, documentType must be one of: ktp, kk, slip_gaji, npwp, rekening_koran', {
      allowed: Array.from(baleDocumentTypes),
    });
  }

  if (channel === 'branch' && !branchDocumentTypes.has(documentType)) {
    throw createHttpError(400, 'For branch channel, documentType must be one of: application_form, supporting_document, salary_slip, other', {
      allowed: Array.from(branchDocumentTypes),
    });
  }
}

async function listEvidence(caseId) {
  return (await caseService.getCase(caseId)).evidence;
}

module.exports = {
  upload,
  addEvidence,
  listEvidence,
  getPresignedUrl,
  confirmS3Upload,
  normalizeDocumentType,
};
