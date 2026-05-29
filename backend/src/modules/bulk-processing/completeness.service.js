/**
 * Completeness Check Service
 *
 * Checks each nasabah's document set against the official KPR Subsidi BTN checklist.
 * Supports multiple profiles: pemohon tunggal, menikah, karyawan, wiraswasta, join income.
 */

// ─── KPR Subsidi BTN Checklist (Official) ─────────────────────────────────────

const KPR_CHECKLIST = {
  data_diri: {
    label: 'A. Data Diri',
    items: [
      { type: 'formulir_aplikasi', label: 'Formulir Aplikasi Kredit', required: true },
      { type: 'pas_foto', label: 'Pas Foto Pemohon', required: true },
      { type: 'ktp', label: 'KTP Pemohon', required: true },
      { type: 'kk', label: 'Kartu Keluarga', required: true },
      { type: 'npwp', label: 'NPWP Pemohon', required: true },
      { type: 'surat_pemesanan_rumah', label: 'Surat Pemesanan Rumah', required: true },
    ],
  },
  data_pasangan: {
    label: 'B. Data Pasangan (Jika Menikah)',
    condition: 'menikah',
    items: [
      { type: 'pas_foto', label: 'Pas Foto Pasangan', required: true },
      { type: 'ktp', label: 'KTP Pasangan', required: true },
      { type: 'npwp', label: 'NPWP Pasangan', required: true },
      { type: 'akta_nikah', label: 'Akta Nikah / Buku Nikah / Akta Cerai', required: true, alternates: ['akta_cerai'] },
    ],
  },
  penghasilan_karyawan: {
    label: 'C. Data Penghasilan - Karyawan',
    condition: 'karyawan',
    items: [
      { type: 'rekening_koran', label: 'Rekening Koran Tabungan (3 bulan)', required: true, minCount: 3 },
      { type: 'slip_gaji', label: 'Slip Gaji / Surat Keterangan Penghasilan', required: true, alternates: ['surat_keterangan_kerja'] },
      { type: 'surat_keterangan_kerja', label: 'Surat Keterangan Kerja', required: false },
    ],
  },
  penghasilan_wiraswasta: {
    label: 'C. Data Penghasilan - Wiraswasta',
    condition: 'wiraswasta',
    items: [
      { type: 'rekening_koran', label: 'Rekening Koran Tabungan (6 bulan)', required: true, minCount: 6 },
      { type: 'nib', label: 'NIB (Nomor Induk Berusaha)', required: true },
      { type: 'laporan_keuangan', label: 'Laporan Keuangan Usaha (6 bulan)', required: true },
      { type: 'info_usaha', label: 'Dokumen Informasi Usaha', required: true },
    ],
  },
  join_income_karyawan: {
    label: 'D. Tambahan Pasangan - Karyawan',
    condition: 'join_income_karyawan',
    items: [
      { type: 'rekening_koran', label: 'Rekening Koran Pasangan (3 bulan)', required: true, minCount: 3 },
      { type: 'slip_gaji', label: 'Slip Gaji Pasangan', required: true, alternates: ['surat_keterangan_kerja'] },
      { type: 'surat_keterangan_kerja', label: 'Surat Keterangan Kerja Pasangan', required: false },
    ],
  },
  join_income_wiraswasta: {
    label: 'D. Tambahan Pasangan - Wiraswasta',
    condition: 'join_income_wiraswasta',
    items: [
      { type: 'rekening_koran', label: 'Rekening Koran Pasangan (6 bulan)', required: true, minCount: 6 },
      { type: 'nib', label: 'NIB Pasangan', required: true },
      { type: 'laporan_keuangan', label: 'Laporan Keuangan Pasangan (6 bulan)', required: true },
      { type: 'info_usaha', label: 'Dokumen Informasi Usaha Pasangan', required: true },
    ],
  },
  dokumen_pendukung: {
    label: 'E. Dokumen Pendukung',
    items: [
      { type: 'spt_pajak', label: 'SPT', required: false },
      { type: 'siup_tdp', label: 'SIUP / TDP', required: false },
      { type: 'akta_pendirian', label: 'Akta Pendirian + Pengesahan DEPKUMHAM', required: false },
      { type: 'izin_praktik', label: 'Izin Praktik Profesi', required: false },
      { type: 'sertifikat_tanah', label: 'Sertifikat', required: false },
      { type: 'imb', label: 'IMB', required: false },
    ],
  },
};

// ─── Profile Detection ────────────────────────────────────────────────────────

const EMPLOYEE_INCOME_TYPES = ['slip_gaji', 'surat_keterangan_kerja'];
const BUSINESS_INCOME_TYPES = ['nib', 'laporan_keuangan', 'info_usaha'];

function countMatchingTypes(typeSet, documentTypes) {
  return documentTypes.reduce((count, type) => count + (typeSet.has(type) ? 1 : 0), 0);
}

function buildTypeCounts(documentTypes) {
  const counts = {};
  for (const type of documentTypes) {
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function getAvailableCount(typeCounts, doc) {
  const directCount = typeCounts[doc.type] || 0;
  const alternateCount = (doc.alternates || []).reduce((sum, alt) => sum + (typeCounts[alt] || 0), 0);
  return directCount + alternateCount;
}

function consumeAvailableCount(typeCounts, doc, amount) {
  let remaining = amount;

  const consumeFromType = (type) => {
    if (remaining <= 0) return;
    const available = typeCounts[type] || 0;
    if (available <= 0) return;

    const used = Math.min(available, remaining);
    typeCounts[type] -= used;
    remaining -= used;
  };

  consumeFromType(doc.type);
  for (const alternateType of doc.alternates || []) {
    consumeFromType(alternateType);
  }
}

/**
 * Detect nasabah profile from their document types.
 * @param {string[]} documentTypes
 * @returns {{ menikah: boolean, incomeType: 'karyawan'|'wiraswasta'|'unknown', joinIncome: boolean, joinIncomeType: 'karyawan'|'wiraswasta'|null }}
 */
function detectProfile(documentTypes) {
  const types = new Set(documentTypes);
  const typeCounts = buildTypeCounts(documentTypes);

  const menikah = types.has('akta_nikah');
  const spouseIdentityEvidence = ['pas_foto', 'ktp', 'npwp'].filter((type) => (typeCounts[type] || 0) > 1).length;

  // Income classification is evidence-based so mixed employee/business files
  // can be surfaced as join income instead of being collapsed into one bucket.
  const employeeEvidence = countMatchingTypes(types, EMPLOYEE_INCOME_TYPES);
  const businessEvidence = countMatchingTypes(types, BUSINESS_INCOME_TYPES);

  let incomeType = 'karyawan';
  let joinIncome = false;
  let joinIncomeType = null;

  if (menikah && spouseIdentityEvidence >= 2 && employeeEvidence > 0 && businessEvidence > 0) {
    joinIncome = true;
    if (businessEvidence > employeeEvidence) {
      incomeType = 'wiraswasta';
      joinIncomeType = 'karyawan';
    } else {
      incomeType = 'karyawan';
      joinIncomeType = 'wiraswasta';
    }
  } else if (businessEvidence > 0) {
    incomeType = 'wiraswasta';
  } else if (employeeEvidence > 0) {
    incomeType = 'karyawan';
  }

  return { menikah, incomeType, joinIncome, joinIncomeType };
}

// ─── Completeness Check ───────────────────────────────────────────────────────

/**
 * Check completeness for a single nasabah.
 * @param {string[]} documentTypes - Array of document types assigned to this nasabah
 * @param {{ menikah?: boolean, incomeType?: string, joinIncome?: boolean, joinIncomeType?: string }} [profileOverride]
 * @returns {{ categories: object, score: number, totalRequired: number, foundRequired: number, missing: string[], warnings: string[], profile: object }}
 */
function checkCompleteness(documentTypes, profileOverride) {
  const remainingTypeCounts = buildTypeCounts(documentTypes);
  const profile = { ...detectProfile(documentTypes), ...(profileOverride || {}) };

  // Determine which sections apply
  const activeSections = ['data_diri'];

  if (profile.menikah) {
    activeSections.push('data_pasangan');
  }

  if (profile.incomeType === 'wiraswasta') {
    activeSections.push('penghasilan_wiraswasta');
  } else {
    activeSections.push('penghasilan_karyawan');
  }

  if (profile.joinIncome) {
    if (profile.joinIncomeType === 'wiraswasta') {
      activeSections.push('join_income_wiraswasta');
    } else {
      activeSections.push('join_income_karyawan');
    }
  }

  activeSections.push('dokumen_pendukung');

  // Check each section
  const categories = {};
  let totalRequired = 0;
  let foundRequired = 0;
  const missing = [];
  const warnings = [];

  for (const sectionKey of activeSections) {
    const section = KPR_CHECKLIST[sectionKey];
    if (!section) continue;

    const items = [];

    for (const doc of section.items) {
      const totalCount = getAvailableCount(remainingTypeCounts, doc);

      let status = 'missing';

      if (doc.required) {
        totalRequired += 1;
      }

      if (totalCount > 0) {
        if (doc.minCount && totalCount < doc.minCount) {
          status = 'incomplete';
          warnings.push(`${doc.label}: baru ${totalCount}, butuh minimal ${doc.minCount}`);
          if (doc.required) foundRequired += 0.5;
          consumeAvailableCount(remainingTypeCounts, doc, totalCount);
        } else {
          status = 'found';
          if (doc.required) foundRequired += 1;
          consumeAvailableCount(remainingTypeCounts, doc, doc.minCount || 1);
        }
      } else if (doc.required) {
        missing.push(doc.label);
      } else {
        status = 'not_provided';
      }

      items.push({
        type: doc.type,
        label: doc.label,
        status,
        count: totalCount,
        required: doc.required,
      });
    }

    categories[sectionKey] = {
      label: section.label,
      condition: section.condition || null,
      active: true,
      items,
    };
  }

  // Add inactive sections for reference
  for (const [key, section] of Object.entries(KPR_CHECKLIST)) {
    if (!activeSections.includes(key)) {
      categories[key] = {
        label: section.label,
        condition: section.condition || null,
        active: false,
        items: section.items.map((doc) => ({
          type: doc.type,
          label: doc.label,
          status: 'not_applicable',
          count: 0,
          required: doc.required,
        })),
      };
    }
  }

  const score = totalRequired > 0 ? Math.round((foundRequired / totalRequired) * 100) / 100 : 0;

  return {
    categories,
    score,
    totalRequired,
    foundRequired: Math.round(foundRequired * 10) / 10,
    missing,
    warnings,
    profile,
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
  detectProfile,
  KPR_CHECKLIST,
};
