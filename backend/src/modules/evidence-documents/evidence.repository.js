const { getSupabase, unwrapSupabase } = require('../../data/supabase');
const { mapEvidenceRow } = require('../../data/case-mappers');

async function insertEvidence(caseId, items, files) {
  const supabase = getSupabase();
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

async function findEvidenceContentById(evidenceId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('evidence_documents')
    .select('id, filename, size, base64_data, mime_type')
    .eq('id', evidenceId)
    .maybeSingle();

  const row = unwrapSupabase(result, 'load evidence payload');
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    originalname: row.filename,
    size: row.size,
    base64Data: row.base64_data,
    mimeType: row.mime_type,
  };
}

module.exports = {
  insertEvidence,
  findEvidenceContentById,
};
