/**
 * Nasabah Grouping Service
 *
 * Groups classified documents by nasabah (applicant).
 *
 * Strategy:
 *   1. Documents from the same source file default to the same nasabah
 *      (a single PDF typically belongs to one applicant).
 *   2. If multiple distinct NIKs are found within one file, split into separate nasabah.
 *   3. Across different files, merge nasabah by NIK or fuzzy name match.
 */

const { randomUUID } = require('node:crypto');

/**
 * Group documents by nasabah.
 * @param {Array<{ id: string, documentType: string, sourceFilename: string, extractedFields: object }>} documents
 * @returns {Array<{ id: string, nik: string|null, fullName: string|null, address: string|null, documentIds: string[] }>}
 */
function groupByNasabah(documents) {
  // Step 1: Group by source file first
  const fileGroups = new Map(); // sourceFilename → docs[]
  for (const doc of documents) {
    if (doc.documentType === 'unknown') continue;
    const key = doc.sourceFilename || '__no_file__';
    if (!fileGroups.has(key)) fileGroups.set(key, []);
    fileGroups.get(key).push(doc);
  }

  // Step 2: Within each file group, extract identities and split only if multiple distinct NIKs
  const nasabahList = []; // { id, nik, fullName, address, documentIds }

  for (const [, docs] of fileGroups) {
    const identities = extractIdentitiesFromDocs(docs);

    if (identities.length <= 1) {
      // All docs in this file belong to one nasabah
      const identity = identities[0] || { nik: null, name: null, address: null };
      nasabahList.push({
        id: randomUUID(),
        nik: identity.nik,
        fullName: identity.name,
        address: identity.address,
        documentIds: docs.map((d) => d.id),
      });
    } else {
      // Multiple distinct NIKs found — split docs by NIK
      for (const identity of identities) {
        const matchedDocs = docs.filter((d) => {
          const fields = d.extractedFields || {};
          const docNik = fields.nik || fields.noKK || null;
          const docName = fields.nama || fields.fullName || fields.kepalaKeluarga || fields.suami || fields.atasNama || null;
          if (docNik && docNik === identity.nik) return true;
          if (!docNik && docName && identity.name && calculateSimilarity(normalizeName(docName), normalizeName(identity.name)) >= 0.75) return true;
          return false;
        });

        if (matchedDocs.length > 0) {
          nasabahList.push({
            id: randomUUID(),
            nik: identity.nik,
            fullName: identity.name,
            address: identity.address,
            documentIds: matchedDocs.map((d) => d.id),
          });
        }
      }

      // Docs that didn't match any identity — assign to first nasabah in this file
      const assignedIds = new Set(nasabahList.flatMap((n) => n.documentIds));
      const unmatched = docs.filter((d) => !assignedIds.has(d.id));
      if (unmatched.length > 0 && nasabahList.length > 0) {
        const lastNasabah = nasabahList[nasabahList.length - 1];
        unmatched.forEach((d) => lastNasabah.documentIds.push(d.id));
      }
    }
  }

  // Step 3: Merge nasabah across files by NIK or fuzzy name
  const merged = mergeAcrossFiles(nasabahList);

  // Step 4: Collect truly unassigned docs
  const assignedDocIds = new Set(merged.flatMap((n) => n.documentIds));
  const unassigned = documents
    .filter((d) => !assignedDocIds.has(d.id) && d.documentType !== 'unknown')
    .map((d) => d.id);

  if (unassigned.length > 0) {
    merged.push({
      id: randomUUID(),
      nik: null,
      fullName: 'Tidak Teridentifikasi',
      address: null,
      documentIds: unassigned,
    });
  }

  return merged;
}

/**
 * Extract distinct identities (unique NIKs) from a set of documents.
 */
function extractIdentitiesFromDocs(docs) {
  const nikMap = new Map(); // nik → { nik, name, address }
  let fallbackName = null;
  let fallbackAddress = null;

  for (const doc of docs) {
    const fields = doc.extractedFields || {};
    const nik = fields.nik || fields.noKK || null;
    const name = fields.nama || fields.fullName || fields.kepalaKeluarga || fields.suami || fields.atasNama || fields.namaUsaha || null;
    const address = fields.alamat || fields.address || fields.lokasi || fields.alamatUsaha || null;

    if (nik) {
      if (!nikMap.has(nik)) {
        nikMap.set(nik, { nik, name, address });
      } else {
        const existing = nikMap.get(nik);
        if (name && !existing.name) existing.name = name;
        if (address && !existing.address) existing.address = address;
      }
    }

    if (name && !fallbackName) fallbackName = name;
    if (address && !fallbackAddress) fallbackAddress = address;
  }

  if (nikMap.size === 0) {
    // No NIK found at all — treat as single identity
    return [{ nik: null, name: fallbackName, address: fallbackAddress }];
  }

  return Array.from(nikMap.values());
}

/**
 * Merge nasabah entries across different files if they share NIK or similar name.
 */
function mergeAcrossFiles(nasabahList) {
  const merged = [];

  for (const nasabah of nasabahList) {
    let target = null;

    // Try match by NIK
    if (nasabah.nik) {
      target = merged.find((m) => m.nik === nasabah.nik);
    }

    // Try match by fuzzy name
    if (!target && nasabah.fullName) {
      const normalized = normalizeName(nasabah.fullName);
      if (normalized.length >= 3) {
        target = merged.find((m) => {
          if (!m.fullName) return false;
          return calculateSimilarity(normalized, normalizeName(m.fullName)) >= 0.80;
        });
      }
    }

    if (target) {
      target.documentIds.push(...nasabah.documentIds);
      if (nasabah.nik && !target.nik) target.nik = nasabah.nik;
      if (nasabah.fullName && !target.fullName) target.fullName = nasabah.fullName;
      if (nasabah.address && !target.address) target.address = nasabah.address;
    } else {
      merged.push({ ...nasabah });
    }
  }

  return merged;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i += 1) matrix[i] = [i];
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

module.exports = { groupByNasabah, normalizeName, calculateSimilarity };
