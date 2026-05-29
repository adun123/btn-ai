function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapEvidenceRow(row) {
  return {
    id: row.id,
    documentType: row.document_type,
    filename: row.filename,
    mimetype: row.mimetype || row.mime_type,
    size: row.size,
    notes: row.notes || '',
    uploadedAt: row.uploaded_at,
  };
}

function mapCaseRowToRecord(row, evidence = []) {
  // API responses use camelCase while Supabase rows stay close to the SQL snake_case schema.
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    channel: row.channel,
    status: row.status,
    applicant: normalizeObject(row.applicant),
    property: normalizeObject(row.property),
    notes: row.notes || '',
    evidence,
    extraction: row.extraction || null,
    manualExtractionEdits: normalizeObject(row.manual_extraction_edits),
    auditTrail: normalizeArray(row.audit_trail),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCaseRow(record) {
  // Centralize the inverse mapping so services do not need to know database column names.
  return {
    id: record.id,
    reference_number: record.referenceNumber,
    channel: record.channel,
    status: record.status,
    applicant: normalizeObject(record.applicant),
    property: normalizeObject(record.property),
    notes: record.notes || '',
    extraction: record.extraction || null,
    manual_extraction_edits: normalizeObject(record.manualExtractionEdits),
    audit_trail: normalizeArray(record.auditTrail),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

module.exports = {
  mapCaseRowToRecord,
  mapEvidenceRow,
  toCaseRow,
};
