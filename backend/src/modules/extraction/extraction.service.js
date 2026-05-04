const { nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const caseService = require('../assessment-core/case.service');
const evidenceRepository = require('../evidence-documents/evidence.repository');
const { extractDocument } = require('../provider-gateway/gemini-ocr.service');
const { normalizeDocumentType } = require('../evidence-documents/evidence.service');

function buildBranchExtraction() {
  return {
    channel: 'branch',
    status: 'completed',
    pipeline: 'btn_block_form_ocr',
    generatedAt: nowIso(),
    summary: 'Structured OCR pipeline for BTN block forms with field-level review requirements.',
    fields: [
      { key: 'full_name', value: 'NEEDS_REVIEW', confidence: 0.62, source: 'application_form', reviewRequired: true },
      { key: 'nik', value: '3173XXXXXXXXXXXX', confidence: 0.81, source: 'application_form', reviewRequired: true },
      { key: 'employment_type', value: 'pegawai_tetap', confidence: 0.91, source: 'checkbox_group', reviewRequired: false },
      { key: 'submission_channel', value: 'branch', confidence: 1, source: 'system', reviewRequired: false },
    ],
    warnings: [
      'Template-based OCR should be reviewed for low-confidence fields.',
      'Branch channel assumes BTN block form alignment and checkbox extraction.',
    ],
  };
}

function selectLatestBaleEvidence(evidence, allowedTypes) {
  const latestByType = new Map();

  evidence.forEach((item, index) => {
    if (!allowedTypes.has(item.documentType)) {
      return;
    }

    const uploadedAtMs = Date.parse(item.uploadedAt) || 0;
    const current = latestByType.get(item.documentType);

    if (!current || uploadedAtMs > current.uploadedAtMs || (uploadedAtMs === current.uploadedAtMs && index > current.index)) {
      latestByType.set(item.documentType, {
        item,
        uploadedAtMs,
        index,
      });
    }
  });

  return evidence.filter((item) => latestByType.get(item.documentType)?.item === item);
}

async function buildBaleExtraction(record) {
  const allowedTypes = new Set(['ktp', 'kk', 'slip_gaji', 'npwp', 'rekening_koran']);
  const targetEvidence = selectLatestBaleEvidence(record.evidence, allowedTypes);

  if (!targetEvidence.length) {
    throw createHttpError(400, 'Bale extraction requires at least one of: ktp, kk, slip_gaji, npwp, rekening_koran');
  }

  const documents = await Promise.all(targetEvidence.map(async (item) => {
    const payload = await evidenceRepository.findEvidenceContentById(item.id);
    if (!payload) {
      throw createHttpError(500, `Evidence content missing for ${item.filename}`);
    }

    const extracted = await extractDocument({
      documentType: item.documentType,
      mimeType: payload.mimeType,
      base64Data: payload.base64Data,
    });

    const detectedDocumentType = normalizeDocumentType(extracted.documentType);
    if (detectedDocumentType !== item.documentType) {
      throw createHttpError(
        400,
        `Uploaded documentType "${item.documentType}" does not match the detected document type "${detectedDocumentType}". Bale extraction rejected.`,
        {
          code: 'DOCUMENT_TYPE_MISMATCH',
          channel: 'bale',
          expected: item.documentType,
          detected: detectedDocumentType,
          evidenceId: item.id,
          filename: item.filename,
        },
      );
    }

    return {
      evidenceId: item.id,
      filename: item.filename,
      documentType: detectedDocumentType,
      confidence: extracted.confidence,
      summary: extracted.summary,
      fields: extracted.fields,
      warnings: extracted.warnings,
    };
  }));

  const flattenedFields = documents.flatMap((doc) =>
    doc.fields.map((field) => ({
      ...field,
      key: `${doc.documentType}.${field.key}`,
      source: doc.filename,
    })),
  );

  return {
    channel: 'bale',
    status: 'completed',
    pipeline: 'gemini_document_ocr',
    generatedAt: nowIso(),
    summary: 'Gemini OCR pipeline for Bale uploads (KTP, KK, slip gaji, NPWP, rekening koran).',
    documents,
    fields: [
      ...flattenedFields,
      { key: 'submission_channel', value: 'bale', confidence: 1, source: 'system', reviewRequired: false },
    ],
    warnings: documents.flatMap((doc) => doc.warnings),
  };
}

async function startExtraction(caseId, body = {}) {
  const clientCase = body.clientCase;
  const record = await caseService.getCase(caseId, clientCase);
  if (!record.evidence.length) {
    throw createHttpError(400, 'Evidence must be uploaded before extraction starts');
  }

  const extraction = record.channel === 'branch'
    ? buildBranchExtraction()
    : await buildBaleExtraction(record);

  record.extraction = extraction;
  record.status = 'extraction_completed';
  record.auditTrail.push({
    action: 'extraction_started',
    timestamp: nowIso(),
    payload: {
      channel: record.channel,
      pipeline: extraction.pipeline,
    },
  });
  record.updatedAt = nowIso();

  await caseService.saveCaseRecord(record);

  return extraction;
}

async function getExtraction(caseId) {
  const record = await caseService.getCase(caseId);
  if (!record.extraction) {
    throw createHttpError(404, 'Extraction result not found for this case');
  }
  return record.extraction;
}

module.exports = {
  startExtraction,
  getExtraction,
};
