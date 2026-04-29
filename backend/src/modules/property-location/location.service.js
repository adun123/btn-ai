const { nowIso } = require('../../utils/caseFactory');
const { createHttpError } = require('../../utils/httpError');
const caseService = require('../assessment-core/case.service');

function saveLocation(caseId, payload) {
  const record = caseService.getCase(caseId);
  if (!payload?.rawAddressText) {
    throw createHttpError(400, 'rawAddressText is required');
  }

  record.location = {
    rawAddressText: payload.rawAddressText,
    normalizedAddressText: payload.normalizedAddressText || payload.rawAddressText,
    province: payload.province || null,
    cityRegency: payload.cityRegency || null,
    district: payload.district || null,
    subdistrict: payload.subdistrict || null,
    postalCode: payload.postalCode || null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    geocodeConfidence: payload.geocodeConfidence ?? null,
    manuallyConfirmed: Boolean(payload.manuallyConfirmed),
    updatedAt: nowIso(),
  };

  record.auditTrail.push({
    action: 'location_saved',
    timestamp: nowIso(),
    payload: record.location,
  });
  record.updatedAt = nowIso();

  return record;
}

module.exports = { saveLocation };
