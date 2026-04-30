const repository = require('./case.repository');
const { createAssessmentCase, nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');

const allowedChannels = new Set(['branch', 'bale']);

function validateChannel(channel) {
  if (!allowedChannels.has(channel)) {
    throw createHttpError(400, 'channel must be one of: branch, bale');
  }
}

function appendAudit(record, action, payload = {}) {
  record.auditTrail.push({
    action,
    timestamp: nowIso(),
    payload,
  });
  record.updatedAt = nowIso();
}

function createCase(payload) {
  validateChannel(payload.channel);
  const record = createAssessmentCase(payload);
  return repository.saveCase(record);
}

function getCase(caseId) {
  const record = repository.findCaseById(caseId);
  if (!record) {
    throw createHttpError(404, 'Assessment case not found');
  }
  return record;
}

function getCaseList() {
  return repository.listCases();
}

function patchCase(caseId, payload) {
  const record = getCase(caseId);
  if (payload.notes !== undefined) record.notes = payload.notes;
  if (payload.applicant !== undefined) record.applicant = payload.applicant;
  if (payload.property !== undefined) record.property = payload.property;
  if (payload.manualExtractionEdits !== undefined) {
    if (payload.manualExtractionEdits && typeof payload.manualExtractionEdits === 'object' && !Array.isArray(payload.manualExtractionEdits)) {
      record.manualExtractionEdits = payload.manualExtractionEdits;
    } else {
      throw createHttpError(400, 'manualExtractionEdits must be an object');
    }
  }

  appendAudit(record, 'case_updated', payload);
  return repository.saveCase(record);
}

function updateStatus(caseId, status) {
  const record = getCase(caseId);
  if (!status || typeof status !== 'string') {
    throw createHttpError(400, 'status is required');
  }

  record.status = status;
  appendAudit(record, 'status_updated', { status });
  return repository.saveCase(record);
}

module.exports = {
  createCase,
  getCase,
  getCaseList,
  patchCase,
  updateStatus,
};
