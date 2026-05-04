const { getSupabase, unwrapSupabase } = require('../../data/supabase');
const { mapCaseRowToRecord, mapEvidenceRow, toCaseRow } = require('../../data/case-mappers');

async function loadEvidenceRows(caseIds) {
  if (!caseIds.length) {
    return [];
  }

  const supabase = getSupabase();
  const result = await supabase
    .from('evidence_documents')
    .select('id, case_id, document_type, filename, mimetype, size, notes, uploaded_at')
    .in('case_id', caseIds)
    .order('uploaded_at', { ascending: true });

  return unwrapSupabase(result, 'load evidence documents');
}

function buildEvidenceMap(rows) {
  return rows.reduce((accumulator, row) => {
    const items = accumulator.get(row.case_id) || [];
    items.push(mapEvidenceRow(row));
    accumulator.set(row.case_id, items);
    return accumulator;
  }, new Map());
}

async function hydrateCases(caseRows) {
  const evidenceRows = await loadEvidenceRows(caseRows.map((row) => row.id));
  const evidenceByCaseId = buildEvidenceMap(evidenceRows);

  return caseRows.map((row) => mapCaseRowToRecord(row, evidenceByCaseId.get(row.id) || []));
}

async function saveCase(record) {
  const supabase = getSupabase();
  const result = await supabase
    .from('cases')
    .upsert(toCaseRow(record))
    .select('*')
    .single();

  const saved = unwrapSupabase(result, 'save case');
  const [hydrated] = await hydrateCases([saved]);
  return hydrated;
}

async function findCaseById(caseId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  const row = unwrapSupabase(result, 'load case');
  if (!row) {
    return null;
  }

  const [hydrated] = await hydrateCases([row]);
  return hydrated;
}

async function listCases() {
  const supabase = getSupabase();
  const result = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = unwrapSupabase(result, 'list cases');
  return hydrateCases(rows);
}

async function deleteCase(caseId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('cases')
    .delete()
    .eq('id', caseId)
    .select('id');

  const rows = unwrapSupabase(result, 'delete case');
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  saveCase,
  findCaseById,
  listCases,
  deleteCase,
};
