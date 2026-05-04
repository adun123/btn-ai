const { nowIso } = require('./caseFactory');

const allowedChannels = new Set(['branch', 'bale']);

/**
 * When running on serverless, in-memory state is not shared across instances.
 * The client may send the last known case JSON so this instance can rebuild the record.
 */
function normalizeClientCaseSnapshot(caseId, snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  if (snapshot.id !== caseId) {
    return null;
  }

  if (!allowedChannels.has(snapshot.channel)) {
    return null;
  }

  const ts = nowIso();

  return {
    id: caseId,
    referenceNumber:
      typeof snapshot.referenceNumber === 'string' && snapshot.referenceNumber.trim()
        ? snapshot.referenceNumber.trim()
        : `KPR-${Date.now().toString().slice(-8)}`,
    channel: snapshot.channel,
    status: typeof snapshot.status === 'string' && snapshot.status.trim() ? snapshot.status : 'draft',
    applicant: snapshot.applicant && typeof snapshot.applicant === 'object' && !Array.isArray(snapshot.applicant)
      ? snapshot.applicant
      : {},
    property: snapshot.property && typeof snapshot.property === 'object' && !Array.isArray(snapshot.property)
      ? snapshot.property
      : {},
    notes: typeof snapshot.notes === 'string' ? snapshot.notes : '',
    location: snapshot.location ?? null,
    evidence: Array.isArray(snapshot.evidence) ? snapshot.evidence : [],
    extraction: snapshot.extraction ?? null,
    manualExtractionEdits:
      snapshot.manualExtractionEdits &&
      typeof snapshot.manualExtractionEdits === 'object' &&
      !Array.isArray(snapshot.manualExtractionEdits)
        ? snapshot.manualExtractionEdits
        : {},
    auditTrail: Array.isArray(snapshot.auditTrail)
      ? snapshot.auditTrail
      : [
          {
            action: 'rehydrated_from_client',
            timestamp: ts,
            payload: {},
          },
        ],
    createdAt: typeof snapshot.createdAt === 'string' ? snapshot.createdAt : ts,
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : ts,
  };
}

function splitClientCasePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { clientCase: undefined, rest: {} };
  }

  const { clientCase, ...rest } = payload;
  return { clientCase, rest };
}

module.exports = {
  normalizeClientCaseSnapshot,
  splitClientCasePayload,
};
