const { getSupabase, unwrapSupabase } = require('../../data/supabase');
const { randomUUID } = require('node:crypto');
const { nowIso } = require('../../utils/caseFactory');

async function createProcessingJob(caseId) {
  const supabase = getSupabase();
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const result = await supabase
    .from('processing_jobs')
    .insert({
      id: jobId,
      case_id: caseId, // caseId should be a UUID string from the cases table
      status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select()
    .single();

  return unwrapSupabase(result, 'create processing job');
}

async function updateJobStatus(jobId, status, result = null, error = null) {
  const supabase = getSupabase();
  const updateData = {
    status,
    updated_at: nowIso(),
  };

  if (result !== null) {
    updateData.result = result;
  }

  if (error !== null) {
    updateData.error = error;
  }

  const dbResult = await supabase
    .from('processing_jobs')
    .update(updateData)
    .eq('id', jobId)
    .select()
    .single();

  return unwrapSupabase(dbResult, 'update job status');
}

async function getJobStatus(jobId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  return unwrapSupabase(result, 'get job status');
}

async function getJobsByCaseId(caseId) {
  const supabase = getSupabase();
  const result = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  return unwrapSupabase(result, 'get jobs by case id');
}

function generateJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

module.exports = {
  createProcessingJob,
  updateJobStatus,
  getJobStatus,
  getJobsByCaseId,
  generateJobId,
};
