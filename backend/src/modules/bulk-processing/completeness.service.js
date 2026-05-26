/**
 * Completeness Check Service
 *
 * Checks each nasabah's document set against KPR requirements.
 * Reports what's present, missing, and incomplete.
 */

// BTN KPR Subsidi document checklist
const KPR_CHECKLIST = {
  data_diri: {
    label: 'Data Diri',
    required: [
      { type: 'formulir_aplikasi_kredit', label: 'Formulir Aplikasi Kredit', required: true },
      { type: 'pas_foto', label: 'Pas Foto Pemohon', required: true },
      { type: 'ktp', label: 'KTP Pemohon', required: true },
      { type: 'kk', label: 'Kartu Keluarga', required: true },
      { type: 'npwp', label: 'NPWP Pemohon', required: true },
      { type: 'surat_pemesanan_rumah', label: 'Surat Pemesanan Rumah', required: true },
    ],
    optional: [],
  },
  data_pasangan: {
    label: 'Data Pasangan (Jika Sudah Menikah)',
    required: [
      { type: 'pas_foto_pasangan', label: 'Pas Foto Pasangan', required: true },
      { type: 'ktp_pasangan', label: 'KTP Pasangan', required: true },
      { type: 'npwp_pasangan', label: 'NPWP Pasangan', required: true },
    ],
    optional: [
      { type: 'akta_nikah', label: 'Akta Nikah / Buku Nikah', required: false },
      { type: 'akta_cerai', label: 'Akta Cerai', required: false },
    ],
  },
  penghasilan_fixed: {
    label: 'Data Penghasilan (Fixed Income)',
    required: [
      { type: 'rekening_koran', label: 'Rekening Koran (3 bulan)', required: true },
      { type: 'slip_gaji', label: 'Slip Gaji / Surat Keterangan Penghasilan', required: true },
    ],
    optional: [
      { type: 'surat_keterangan_kerja', label: 'Surat Keterangan Kerja', required: false },
    ],
  },
  penghasilan_non_fixed: {
    label: 'Data Penghasilan (Non Fixed Income)',
    required: [
      { type: 'rekening_koran', label: 'Rekening Koran (6 bulan)', required: true },
      { type: 'nib', label: 'NIB', required: true },
      { type: 'laporan_keuangan_usaha', label: 'Laporan Keuangan Usaha (6 Bulan)', required: true },
      { type: 'dokumen_informasi_usaha', label: 'Dokumen Informasi Usaha', required: true },
    ],
    optional: [],
  },
  dokumen_pendukung: {
    label: 'Dokumen Pendukung Lainnya',
    required: [],
    optional: [
      { type: 'spt_pajak', label: 'SPT Pajak', required: false },
      { type: 'siup_tdp', label: 'SIUP / TDP', required: false },
      { type: 'akte_pendirian', label: 'Akte Pendirian & Pengesahan DEPKUMHAM', required: false },
      { type: 'izin_praktik', label: 'Izin Praktik', required: false },
      { type: 'sertifikat_tanah', label: 'Sertifikat', required: false },
      { type: 'imb', label: 'IMB', required: false },
    ],
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
