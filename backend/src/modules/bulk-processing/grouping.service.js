/**
 * Nasabah Grouping Service
 *
 * Groups classified documents by nasabah (applicant) using:
 *   - NIK as primary key (unique per person)
 *   - Fuzzy name matching as secondary
 *   - Address similarity as tertiary
 */

const { randomUUID } = require('node:crypto');

/**
 * Group documents by nasabah.
 * @param {Array<{ id: string, documentType: string, extractedFields: { nik?: string, fullName?: string, address?: string } }>} documents
 * @returns {Array<{ id: string, nik: string|null, fullName: string|null, address: string|null, documentIds: string[] }>}
 */
function groupByNasabah(documents) {
  const nasabahMap = new Map(); // key: nik or fuzzy-name-key → nasabah

  for (const doc of documents) {
    if (doc.documentType === 'unknown') continue;

    const fields = doc.extractedFields || {};
    const nik = fields.nik || null;
    const name = fields.fullName || null;
    const address = fields.address || null;

    // Try to find existing nasabah
    let matchedNasabah = null;

    // Priority 1: Match by NIK
    if (nik) {
      matchedNasabah = findByNik(nasabahMap, nik);
    }

    // Priority 2: Match by fuzzy name
    if (!matchedNasabah && name) {
      matchedNasabah = findByFuzzyName(nasabahMap, name);
    }

    if (matchedNasabah) {
      matchedNasabah.documentIds.push(doc.id);
      // Update with better data
      if (nik && !matchedNasabah.nik) matchedNasabah.nik = nik;
      if (name && !matchedNasabah.fullName) matchedNasabah.fullName = name;
      if (address && !matchedNasabah.address) matchedNasabah.address = address;
    } else if (nik || name) {
      // Create new nasabah
      const id = randomUUID();
      const nasabah = {
        id,
        nik,
        fullName: name,
        address,
        documentIds: [doc.id],
      };
      nasabahMap.set(id, nasabah);
    }
    // else: doc has no identifiers, will go to "unidentified"
  }

  // Collect unassigned documents
  const assignedDocIds = new Set();
  for (const nasabah of nasabahMap.values()) {
    for (const docId of nasabah.documentIds) {
      assignedDocIds.add(docId);
    }
  }

  const unassigned = documents
    .filter((d) => !assignedDocIds.has(d.id) && d.documentType !== 'unknown')
    .map((d) => d.id);

  if (unassigned.length > 0) {
    nasabahMap.set('unidentified', {
      id: randomUUID(),
      nik: null,
      fullName: 'Tidak Teridentifikasi',
      address: null,
      documentIds: unassigned,
    });
  }

  return Array.from(nasabahMap.values());
}

function findByNik(nasabahMap, nik) {
  for (const nasabah of nasabahMap.values()) {
    if (nasabah.nik === nik) return nasabah;
  }
  return null;
}

function findByFuzzyName(nasabahMap, name) {
  const normalizedInput = normalizeName(name);
  if (normalizedInput.length < 3) return null;

  for (const nasabah of nasabahMap.values()) {
    if (!nasabah.fullName) continue;
    const normalizedExisting = normalizeName(nasabah.fullName);
    const similarity = calculateSimilarity(normalizedInput, normalizedExisting);
    if (similarity >= 0.80) {
      return nasabah;
    }
  }
  return null;
}

/**
 * Normalize a name for comparison.
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple Levenshtein-based similarity (0 to 1).
 */
function calculateSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

module.exports = {
  groupByNasabah,
  normalizeName,
  calculateSimilarity,
};
