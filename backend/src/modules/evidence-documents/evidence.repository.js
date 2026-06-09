const { getSupabase, unwrapSupabase } = require('../../data/supabase');
const { mapEvidenceRow } = require('../../data/case-mappers');
const { downloadFile } = require('../storage/s3.service');

async function insertEvidence(caseId, items, files) {
  const supabase = getSupabase();
  // This PoC stores file bytes as base64 in Postgres; production should move payloads to object storage.
  const rows = items.map((item, index) => ({
    id: item.id,
    case_id: caseId,
    document_type: item.documentType,
    filename: item.filename,
    mimetype: item.mimetype,
    size: item.size,
    notes: item.notes || '',
    uploaded_at: item.uploadedAt,
    base64_data: files[index].buffer.toString('base64'),
    mime_type: files[index].mimetype,
  }));

  const result = await supabase
    .from('evidence_documents')
    .insert(rows)
    .select('id, case_id, document_type, filename, mimetype, size, notes, uploaded_at');

  return unwrapSupabase(result, 'insert evidence').map(mapEvidenceRow);
}

async function insertEvidenceWithS3Key(caseId, items) {
  const supabase = getSupabase();
  // New approach: store only S3 key reference, not base64 data
  const rows = items.map((item) => ({
    id: item.id,
    case_id: caseId,
    document_type: item.documentType,
    filename: item.filename,
    mimetype: item.mimetype,
    size: item.size,
    notes: item.notes || '',
    uploaded_at: item.uploadedAt,
    s3_key: item.s3Key,
    s3_url: item.s3Url || null,
    base64_data: null, // No base64 for S3 uploads
    mime_type: item.mimetype,
  }));

  const result = await supabase
    .from('evidence_documents')
    .insert(rows)
    .select('id, case_id, document_type, filename, mimetype, size, notes, uploaded_at, s3_key');

  return unwrapSupabase(result, 'insert evidence with S3 key').map(mapEvidenceRow);
}

async function findEvidenceContentById(evidenceId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('evidence_documents')
    .select('id, filename, size, base64_data, s3_key, mime_type')
    .eq('id', evidenceId)
    .maybeSingle();

  const row = unwrapSupabase(result, 'load evidence payload');
  if (!row) {
    return null;
  }

  // If base64_data exists, use it (legacy uploads)
  if (row.base64_data) {
    return {
      id: row.id,
      originalname: row.filename,
      size: row.size,
      base64Data: row.base64_data,
      mimeType: row.mime_type,
    };
  }

  // If s3_key exists, download from S3
  if (row.s3_key) {
    try {
      const buffer = await downloadFile(row.s3_key);
      return {
        id: row.id,
        originalname: row.filename,
        size: row.size,
        base64Data: buffer.toString('base64'),
        mimeType: row.mime_type,
      };
    } catch (error) {
      console.error(`Failed to download file from S3: ${row.s3_key}`, error);
      throw new Error(`Failed to download file from S3: ${error.message}`);
    }
  }

  // No data available
  return null;
}

async function updateEvidenceS3Url(evidenceId, s3Url) {
  const supabase = getSupabase();
  const result = await supabase
    .from('evidence_documents')
    .update({ s3_url: s3Url })
    .eq('id', evidenceId)
    .select('id, s3_url')
    .single();

  return unwrapSupabase(result, 'update evidence S3 URL');
}

module.exports = {
  insertEvidence,
  insertEvidenceWithS3Key,
  findEvidenceContentById,
  updateEvidenceS3Url,
};
