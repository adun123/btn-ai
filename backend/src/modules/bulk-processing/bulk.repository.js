const { getSupabase, unwrapSupabase } = require('../../data/supabase');

// ─── Job CRUD ───────────────────────────────────────────────────────────────

async function createJob(job) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_jobs').insert({
    id: job.id,
    status: job.status,
    upload_type: job.uploadType,
    total_files: job.totalFiles,
    total_pages: job.totalPages,
    processed_pages: job.processedPages,
    batch_count: job.batchCount,
    batch_size: job.batchSize,
    error: job.error || null,
    result: job.result || null,
    metadata: job.metadata || {},
  }).select().single();

  return mapJobRow(unwrapSupabase(result, 'create bulk job'));
}

async function updateJob(jobId, updates) {
  const supabase = getSupabase();
  const row = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.totalPages !== undefined) row.total_pages = updates.totalPages;
  if (updates.processedPages !== undefined) row.processed_pages = updates.processedPages;
  if (updates.batchCount !== undefined) row.batch_count = updates.batchCount;
  if (updates.error !== undefined) row.error = updates.error;
  if (updates.result !== undefined) row.result = updates.result;
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;
  if (updates.metadata !== undefined) row.metadata = updates.metadata;

  const result = await supabase.from('bulk_jobs').update(row).eq('id', jobId).select().single();
  return mapJobRow(unwrapSupabase(result, 'update bulk job'));
}

async function findJobById(jobId) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_jobs').select('*').eq('id', jobId).maybeSingle();
  const row = unwrapSupabase(result, 'find bulk job');
  return row ? mapJobRow(row) : null;
}

async function listJobs(limit = 50) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_jobs').select('*').order('created_at', { ascending: false }).limit(limit);
  return unwrapSupabase(result, 'list bulk jobs').map(mapJobRow);
}

async function deleteJob(jobId) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_jobs').delete().eq('id', jobId);
  if (result.error) unwrapSupabase(result, 'delete bulk job');
}

// ─── Pages CRUD ─────────────────────────────────────────────────────────────

async function insertPages(pages) {
  const supabase = getSupabase();
  const rows = pages.map((p) => ({
    id: p.id,
    job_id: p.jobId,
    source_filename: p.sourceFilename,
    page_number: p.pageNumber,
    batch_index: p.batchIndex,
    status: p.status || 'pending',
  }));

  const result = await supabase.from('bulk_pages').insert(rows).select();
  return unwrapSupabase(result, 'insert bulk pages').map(mapPageRow);
}

async function updatePage(pageId, updates) {
  const supabase = getSupabase();
  const row = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.ocrText !== undefined) row.ocr_text = updates.ocrText;
  if (updates.ocrConfidence !== undefined) row.ocr_confidence = updates.ocrConfidence;
  if (updates.ocrRaw !== undefined) row.ocr_raw = updates.ocrRaw;
  if (updates.error !== undefined) row.error = updates.error;

  const result = await supabase.from('bulk_pages').update(row).eq('id', pageId).select().single();
  return mapPageRow(unwrapSupabase(result, 'update bulk page'));
}

async function updatePagesBatch(pageIds, updates) {
  const supabase = getSupabase();
  const row = {};
  if (updates.status !== undefined) row.status = updates.status;

  const result = await supabase.from('bulk_pages').update(row).in('id', pageIds).select();
  return unwrapSupabase(result, 'update bulk pages batch').map(mapPageRow);
}

async function getPagesByJob(jobId) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_pages').select('*').eq('job_id', jobId).order('batch_index').order('page_number');
  return unwrapSupabase(result, 'get pages by job').map(mapPageRow);
}

async function getPagesByBatch(jobId, batchIndex) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_pages').select('*').eq('job_id', jobId).eq('batch_index', batchIndex).order('page_number');
  return unwrapSupabase(result, 'get pages by batch').map(mapPageRow);
}

// ─── Documents CRUD ─────────────────────────────────────────────────────────

async function insertDocuments(documents) {
  const supabase = getSupabase();
  const rows = documents.map((d) => ({
    id: d.id,
    job_id: d.jobId,
    document_type: d.documentType,
    confidence: d.confidence,
    source_filename: d.sourceFilename,
    page_ids: d.pageIds,
    extracted_fields: d.extractedFields || {},
    classification_method: d.classificationMethod || 'rule_based',
    nasabah_id: d.nasabahId || null,
  }));

  const result = await supabase.from('bulk_documents').insert(rows).select();
  return unwrapSupabase(result, 'insert bulk documents').map(mapDocumentRow);
}

async function updateDocument(docId, updates) {
  const supabase = getSupabase();
  const row = {};
  if (updates.nasabahId !== undefined) row.nasabah_id = updates.nasabahId;
  if (updates.extractedFields !== undefined) row.extracted_fields = updates.extractedFields;

  const result = await supabase.from('bulk_documents').update(row).eq('id', docId).select().single();
  return mapDocumentRow(unwrapSupabase(result, 'update bulk document'));
}

async function getDocumentsByJob(jobId) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_documents').select('*').eq('job_id', jobId).order('created_at');
  return unwrapSupabase(result, 'get documents by job').map(mapDocumentRow);
}

// ─── Nasabah CRUD ───────────────────────────────────────────────────────────

async function insertNasabah(records) {
  const supabase = getSupabase();
  const rows = records.map((n) => ({
    id: n.id,
    job_id: n.jobId,
    full_name: n.fullName || null,
    nik: n.nik || null,
    address: n.address || null,
    document_ids: n.documentIds || [],
    completeness: n.completeness || {},
    completeness_score: n.completenessScore || 0,
  }));

  const result = await supabase.from('bulk_nasabah').insert(rows).select();
  return unwrapSupabase(result, 'insert bulk nasabah').map(mapNasabahRow);
}

async function getNasabahByJob(jobId) {
  const supabase = getSupabase();
  const result = await supabase.from('bulk_nasabah').select('*').eq('job_id', jobId).order('created_at');
  return unwrapSupabase(result, 'get nasabah by job').map(mapNasabahRow);
}

async function deleteNasabah(nasabahId) {
  const supabase = getSupabase();

  // Get nasabah to find job_id
  const { data: nasabah } = await supabase.from('bulk_nasabah').select('job_id').eq('id', nasabahId).maybeSingle();

  // Delete associated documents
  await supabase.from('bulk_documents').delete().eq('nasabah_id', nasabahId);
  // Delete nasabah row
  const result = await supabase.from('bulk_nasabah').delete().eq('id', nasabahId);
  if (result.error) unwrapSupabase(result, 'delete nasabah');

  // Also remove from job.result JSONB cache so it doesn't reappear on refresh
  if (nasabah?.job_id) {
    const { data: job } = await supabase.from('bulk_jobs').select('result').eq('id', nasabah.job_id).maybeSingle();
    if (job?.result?.nasabah) {
      const updatedResult = {
        ...job.result,
        nasabah: job.result.nasabah.filter(n => n.id !== nasabahId),
        totalNasabah: Math.max(0, (job.result.totalNasabah ?? job.result.nasabah.length) - 1),
      };
      await supabase.from('bulk_jobs').update({ result: updatedResult }).eq('id', nasabah.job_id);
    }
  }
}

// ─── Row Mappers ────────────────────────────────────────────────────────────

function mapJobRow(row) {
  return {
    id: row.id,
    status: row.status,
    uploadType: row.upload_type,
    totalFiles: row.total_files,
    totalPages: row.total_pages,
    processedPages: row.processed_pages,
    batchCount: row.batch_count,
    batchSize: row.batch_size,
    error: row.error,
    result: row.result,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapPageRow(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    sourceFilename: row.source_filename,
    pageNumber: row.page_number,
    batchIndex: row.batch_index,
    status: row.status,
    ocrText: row.ocr_text,
    ocrConfidence: row.ocr_confidence,
    ocrRaw: row.ocr_raw,
    error: row.error,
    createdAt: row.created_at,
  };
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    documentType: row.document_type,
    confidence: row.confidence,
    sourceFilename: row.source_filename,
    pageIds: row.page_ids,
    extractedFields: row.extracted_fields,
    classificationMethod: row.classification_method,
    nasabahId: row.nasabah_id,
    createdAt: row.created_at,
  };
}

function mapNasabahRow(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    fullName: row.full_name,
    nik: row.nik,
    address: row.address,
    documentIds: row.document_ids,
    completeness: row.completeness,
    completenessScore: row.completeness_score,
    createdAt: row.created_at,
  };
}

module.exports = {
  createJob,
  updateJob,
  findJobById,
  listJobs,
  deleteJob,
  insertPages,
  updatePage,
  updatePagesBatch,
  getPagesByJob,
  getPagesByBatch,
  insertDocuments,
  updateDocument,
  getDocumentsByJob,
  insertNasabah,
  getNasabahByJob,
  deleteNasabah,
};
