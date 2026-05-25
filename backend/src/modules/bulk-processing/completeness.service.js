/**
 * Completeness Check Service
 *
 * Checks each nasabah's document set against KPR requirements.
 * Reports what's present, missing, and incomplete.
 */

// Standard KPR document checklist
const KPR_CHECKLIST = {
  identitas: {
    label: 'Identitas',
    required: [
      { type: 'ktp', label: 'KTP Pemohon', required: true },
      { type: 'kk', label: 'Kartu Keluarga', required: true },
      { type: 'npwp', label: 'NPWP', required: true },
    ],
    optional: [
      { type: 'akta_nikah', label: 'Akta Nikah', required: false },
      { type: 'akta_cerai', label: 'Akta Cerai', required: false },
    ],
  },
  finansial: {
    label: 'Finansial',
    required: [
      { type: 'slip_gaji', label: 'Slip Gaji (3 bulan)', required: true, minCount: 3 },
      { type: 'rekening_koran', label: 'Rekening Koran (6 bulan)', required: true },
    ],
    optional: [
      { type: 'spt_pajak', label: 'SPT Pajak', required: false },
    ],
  },
  properti: {
    label: 'Properti',
    required: [
      { type: 'sertifikat_tanah', label: 'Sertifikat Tanah', required: true },
      { type: 'imb', label: 'IMB / PBG', required: true },
      { type: 'pbb', label: 'PBB Tahun Berjalan', required: true },
    ],
    optional: [
      { type: 'ajb', label: 'Akta Jual Beli', required: false },
    ],
  },
  pendukung: {
    label: 'Pendukung',
    required: [
      { type: 'surat_keterangan_kerja', label: 'Surat Keterangan Kerja', required: false },
    ],
    optional: [],
  },
};

/**
 * Check completeness for a single nasabah.
 * @param {string[]} documentTypes - Array of document types assigned to this nasabah
 * @returns {{ categories: object, score: number, totalRequired: number, foundRequired: number, missing: string[], warnings: string[] }}
 */
function checkCompleteness(documentTypes) {
  const typeCounts = {};
  for (const type of documentTypes) {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const categories = {};
  let totalRequired = 0;
  let foundRequired = 0;
  const missing = [];
  const warnings = [];

  for (const [categoryKey, category] of Object.entries(KPR_CHECKLIST)) {
    const items = [];

    for (const doc of category.required) {
      const count = typeCounts[doc.type] || 0;
      let status = 'missing';

      if (doc.required) {
        totalRequired += 1;
      }

      if (count > 0) {
        if (doc.minCount && count < doc.minCount) {
          status = 'incomplete';
          warnings.push(`${doc.label}: baru ${count}, butuh minimal ${doc.minCount}`);
          if (doc.required) foundRequired += 0.5; // Partial credit
        } else {
          status = 'found';
          if (doc.required) foundRequired += 1;
        }
      } else if (doc.required) {
        missing.push(doc.label);
      }

      items.push({
        type: doc.type,
        label: doc.label,
        status,
        count,
        required: doc.required,
      });
    }

    for (const doc of category.optional) {
      const count = typeCounts[doc.type] || 0;
      items.push({
        type: doc.type,
        label: doc.label,
        status: count > 0 ? 'found' : 'not_provided',
        count,
        required: false,
      });
    }

    categories[categoryKey] = {
      label: category.label,
      items,
    };
  }

  const score = totalRequired > 0 ? Math.round((foundRequired / totalRequired) * 100) / 100 : 0;

  return {
    categories,
    score,
    totalRequired,
    foundRequired: Math.round(foundRequired * 10) / 10,
    missing,
    warnings,
  };
}

/**
 * Check completeness for all nasabah in a job.
 * @param {Array<{ id: string, documentIds: string[] }>} nasabahList
 * @param {Array<{ id: string, documentType: string }>} documents
 * @returns {Array<{ nasabahId: string, completeness: object, completenessScore: number }>}
 */
function checkAllCompleteness(nasabahList, documents) {
  const docMap = new Map(documents.map((d) => [d.id, d]));

  return nasabahList.map((nasabah) => {
    const docTypes = nasabah.documentIds
      .map((id) => docMap.get(id))
      .filter(Boolean)
      .map((d) => d.documentType);

    const completeness = checkCompleteness(docTypes);

    return {
      nasabahId: nasabah.id,
      completeness,
      completenessScore: completeness.score,
    };
  });
}

module.exports = {
  checkCompleteness,
  checkAllCompleteness,
  KPR_CHECKLIST,
};
