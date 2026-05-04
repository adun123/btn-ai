const repository = require('./case.repository');
const { createAssessmentCase, nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const { normalizeClientCaseSnapshot, splitClientCasePayload } = require('../../utils/clientCaseSnapshot');

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

async function createCase(payload) {
  validateChannel(payload.channel);
  const record = createAssessmentCase(payload);
  return repository.saveCase(record);
}

async function getCase(caseId, clientCase) {
  let record = await repository.findCaseById(caseId);
  if (!record && clientCase !== undefined && clientCase !== null) {
    const normalized = normalizeClientCaseSnapshot(caseId, clientCase);
    if (normalized) {
      record = await repository.saveCase(normalized);
    }
  }
  if (!record) {
    throw createHttpError(404, 'Assessment case not found');
  }
  return record;
}

async function getCaseList() {
  return repository.listCases();
}

async function patchCase(caseId, payload) {
  const { clientCase, rest } = splitClientCasePayload(payload);
  const record = await getCase(caseId, clientCase);
  if (rest.notes !== undefined) record.notes = rest.notes;
  if (rest.applicant !== undefined) record.applicant = rest.applicant;
  if (rest.property !== undefined) record.property = rest.property;
  if (rest.manualExtractionEdits !== undefined) {
    if (rest.manualExtractionEdits && typeof rest.manualExtractionEdits === 'object' && !Array.isArray(rest.manualExtractionEdits)) {
      record.manualExtractionEdits = rest.manualExtractionEdits;
    } else {
      throw createHttpError(400, 'manualExtractionEdits must be an object');
    }
  }

  appendAudit(record, 'case_updated', rest);
  return repository.saveCase(record);
}

async function updateStatus(caseId, payload) {
  const { clientCase, rest } = splitClientCasePayload(payload);
  const record = await getCase(caseId, clientCase);
  const status = rest.status;
  if (!status || typeof status !== 'string') {
    throw createHttpError(400, 'status is required');
  }

  record.status = status;
  appendAudit(record, 'status_updated', { status });
  return repository.saveCase(record);
}

async function saveCaseRecord(record) {
  return repository.saveCase(record);
}

module.exports = {
  createCase,
  getCase,
  getCaseList,
  patchCase,
  saveCaseRecord,
  updateStatus,
};
