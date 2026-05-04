const { randomUUID } = require('node:crypto');

function nowIso() {
  return new Date().toISOString();
}

function buildCaseReference() {
  const timestamp = Date.now().toString().slice(-8);
  return `KPR-${timestamp}`;
}

function createAssessmentCase(payload = {}) {
  const timestamp = nowIso();

  return {
    id: randomUUID(),
    referenceNumber: buildCaseReference(),
    channel: payload.channel,
    status: 'draft',
    applicant: payload.applicant ?? {},
    property: payload.property ?? {},
    notes: payload.notes ?? '',
    evidence: [],
    extraction: null,
    manualExtractionEdits: {},
    auditTrail: [
      {
        action: 'case_created',
        timestamp,
        payload: { channel: payload.channel },
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

module.exports = {
  createAssessmentCase,
  nowIso,
};
