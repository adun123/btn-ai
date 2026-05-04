const { nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const { splitClientCasePayload } = require('../../utils/clientCaseSnapshot');
const caseService = require('../assessment-core/case.service');

async function saveLocation(caseId, payload) {
  const { clientCase, rest } = splitClientCasePayload(payload);
  const record = await caseService.getCase(caseId, clientCase);
  if (!rest?.rawAddressText) {
    throw createHttpError(400, 'rawAddressText is required');
  }

  record.location = {
    rawAddressText: rest.rawAddressText,
    normalizedAddressText: rest.normalizedAddressText || rest.rawAddressText,
    province: rest.province || null,
    cityRegency: rest.cityRegency || null,
    district: rest.district || null,
    subdistrict: rest.subdistrict || null,
    postalCode: rest.postalCode || null,
    latitude: rest.latitude ?? null,
    longitude: rest.longitude ?? null,
    geocodeConfidence: rest.geocodeConfidence ?? null,
    manuallyConfirmed: Boolean(rest.manuallyConfirmed),
    updatedAt: nowIso(),
  };

  record.auditTrail.push({
    action: 'location_saved',
    timestamp: nowIso(),
    payload: record.location,
  });
  record.updatedAt = nowIso();

  return caseService.saveCaseRecord(record);
}

module.exports = { saveLocation };
