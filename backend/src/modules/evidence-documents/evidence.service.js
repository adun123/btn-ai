const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const caseService = require('../assessment-core/case.service');
const repository = require('./evidence.repository');

const branchDocumentTypes = new Set(['application_form', 'supporting_document', 'salary_slip', 'other']);
const baleDocumentTypes = new Set(['ktp', 'kk', 'slip_gaji', 'npwp', 'rekening_koran']);

const upload = multer({
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
  normalizeDocumentType,
};
