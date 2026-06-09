const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateAllNasabahRules } = require('./rule-evaluation.service');
const { checkAllCompleteness } = require('./completeness.service');

test('activates spouse and fixed-income checklist with applicant/spouse resolution', () => {
  const nasabahList = [{
    id: 'nasabah-1',
    fullName: 'John Doe',
    nik: '3171111111111111',
    documentIds: ['fak', 'ktp-app', 'ktp-spouse', 'npwp-app', 'npwp-spouse', 'marriage', 'rekening', 'slip'],
  }];

  const documents = [
    {
      id: 'fak',
      documentType: 'formulir_aplikasi_kredit',
      extractedFields: {
        applicantName: 'John Doe',
        applicantNik: '3171111111111111',
        spouseName: 'Jane Doe',
        spouseNik: '3172222222222222',
        maritalStatus: 'Menikah',
        joinIncome: 'Ya',
        incomeType: 'Fixed Income',
      },
    },
    {
      id: 'ktp-app',
      documentType: 'ktp',
      extractedFields: {
        nama: 'John Doe',
        nik: '3171111111111111',
        statusPerkawinan: 'KAWIN',
        pekerjaan: 'Karyawan Tetap',
      },
    },
    {
      id: 'ktp-spouse',
      documentType: 'ktp',
      extractedFields: {
        nama: 'Jane Doe',
        nik: '3172222222222222',
        statusPerkawinan: 'KAWIN',
      },
    },
    {
      id: 'npwp-app',
      documentType: 'npwp',
      extractedFields: { nama: 'John Doe' },
    },
    {
      id: 'npwp-spouse',
      documentType: 'npwp',
      extractedFields: { nama: 'Jane Doe' },
    },
    {
      id: 'marriage',
      documentType: 'akta_nikah',
      extractedFields: { suami: 'John Doe', istri: 'Jane Doe' },
    },
    {
      id: 'rekening',
      documentType: 'rekening_koran',
      extractedFields: { nama: 'John Doe' },
    },
    {
      id: 'slip',
      documentType: 'slip_gaji',
      extractedFields: { nama: 'John Doe' },
    },
  ];

  const ruleResults = evaluateAllNasabahRules(nasabahList, documents);
  const rules = ruleResults[0];
  const completenessResults = checkAllCompleteness(nasabahList, documents, ruleResults);
  const completeness = completenessResults[0].completeness;

  assert.equal(rules.applicant.name, 'John Doe');
  assert.equal(rules.spouse.name, 'Jane Doe');
  assert.equal(rules.maritalStatus, 'married');
  assert.equal(rules.joinIncome, 'yes');
  assert.equal(rules.incomeType, 'fixed');
  assert.equal(rules.typeCounts.ktp, 1);
  assert.equal(rules.typeCounts.ktp_pasangan, 1);
  assert.equal(rules.typeCounts.npwp, 1);
  assert.equal(rules.typeCounts.npwp_pasangan, 1);
  assert.equal(completeness.categories.data_pasangan.active, true);
  assert.equal(completeness.categories.penghasilan_fixed.active, true);
  assert.equal(completeness.categories.penghasilan_non_fixed.active, false);
  assert.ok(!completeness.missing.includes('KTP Pasangan'));
  assert.ok(!completeness.missing.includes('NPWP Pasangan'));
  assert.ok(completeness.missing.includes('Pas Foto Pemohon'));
  assert.ok(completeness.missing.includes('Pas Foto Pasangan'));
  assert.ok(!completeness.missing.includes('NIB'));
  assert.equal(completeness.ruleSummary.maritalStatus, 'married');
  assert.equal(completeness.ruleSummary.joinIncome, 'yes');
});

test('activates non-fixed checklist without spouse requirements for single applicant', () => {
  const nasabahList = [{
    id: 'nasabah-2',
    fullName: 'Adi Wijaya',
    nik: '3173333333333333',
    documentIds: ['fak', 'ktp', 'rekening', 'nib', 'laporan', 'usaha'],
  }];

  const documents = [
    {
      id: 'fak',
      documentType: 'formulir_aplikasi_kredit',
      extractedFields: {
        applicantName: 'Adi Wijaya',
        applicantNik: '3173333333333333',
        maritalStatus: 'Belum Menikah',
        incomeType: 'Non Fixed',
      },
    },
    {
      id: 'ktp',
      documentType: 'ktp',
      extractedFields: {
        nama: 'Adi Wijaya',
        nik: '3173333333333333',
        statusPerkawinan: 'BELUM KAWIN',
        pekerjaan: 'Wiraswasta',
      },
    },
    {
      id: 'rekening',
      documentType: 'rekening_koran',
      extractedFields: { nama: 'Adi Wijaya' },
    },
    {
      id: 'nib',
      documentType: 'nib',
      extractedFields: { namaUsaha: 'Toko Adi' },
    },
    {
      id: 'laporan',
      documentType: 'laporan_keuangan_usaha',
      extractedFields: {},
    },
    {
      id: 'usaha',
      documentType: 'dokumen_informasi_usaha',
      extractedFields: {},
    },
  ];

  const ruleResults = evaluateAllNasabahRules(nasabahList, documents);
  const rules = ruleResults[0];
  const completenessResults = checkAllCompleteness(nasabahList, documents, ruleResults);
  const completeness = completenessResults[0].completeness;

  assert.equal(rules.maritalStatus, 'not_married');
  assert.equal(rules.joinIncome, 'no');
  assert.equal(rules.incomeType, 'non_fixed');
  assert.equal(completeness.categories.data_pasangan.active, false);
  assert.equal(completeness.categories.penghasilan_fixed.active, false);
  assert.equal(completeness.categories.penghasilan_non_fixed.active, true);
  assert.ok(!completeness.missing.includes('KTP Pasangan'));
  assert.ok(!completeness.missing.includes('Slip Gaji / Surat Keterangan Penghasilan'));
  assert.equal(completeness.ruleSummary.incomeType, 'non_fixed');
});

test('parses negative join-income hints before positive substrings', () => {
  const nasabahList = [{
    id: 'nasabah-3',
    fullName: 'Rina Putri',
    nik: '3174444444444444',
    documentIds: ['fak', 'ktp', 'marriage'],
  }];

  const documents = [
    {
      id: 'fak',
      documentType: 'formulir_aplikasi_kredit',
      extractedFields: {
        applicantName: 'Rina Putri',
        applicantNik: '3174444444444444',
        spouseName: 'Budi Putra',
        maritalStatus: 'Menikah',
        joinIncome: 'Tidak join income',
        incomeType: 'Fixed Income',
      },
    },
    {
      id: 'ktp',
      documentType: 'ktp',
      extractedFields: {
        nama: 'Rina Putri',
        nik: '3174444444444444',
        statusPerkawinan: 'KAWIN',
      },
    },
    {
      id: 'marriage',
      documentType: 'akta_nikah',
      extractedFields: { suami: 'Budi Putra', istri: 'Rina Putri' },
    },
  ];

  const [rules] = evaluateAllNasabahRules(nasabahList, documents);

  assert.equal(rules.maritalStatus, 'married');
  assert.equal(rules.joinIncome, 'no');
});

test('keeps unresolved personal docs counted and emits warning instead of dropping them', () => {
  const nasabahList = [{
    id: 'nasabah-4',
    fullName: 'John Doe',
    nik: '3171111111111111',
    documentIds: ['fak', 'ktp-app', 'ktp-unknown', 'marriage'],
  }];

  const documents = [
    {
      id: 'fak',
      documentType: 'formulir_aplikasi_kredit',
      extractedFields: {
        applicantName: 'John Doe',
        spouseName: 'Jane Doe',
        maritalStatus: 'Menikah',
      },
    },
    {
      id: 'ktp-app',
      documentType: 'ktp',
      extractedFields: {
        nama: 'John Doe',
        nik: '3171111111111111',
      },
    },
    {
      id: 'ktp-unknown',
      documentType: 'ktp',
      extractedFields: {
        statusPerkawinan: 'KAWIN',
      },
    },
    {
      id: 'marriage',
      documentType: 'akta_nikah',
      extractedFields: { suami: 'John Doe', istri: 'Jane Doe' },
    },
  ];

  const [rules] = evaluateAllNasabahRules(nasabahList, documents);

  assert.equal(rules.typeCounts.ktp, 2);
  assert.ok(rules.warnings.some((warning) => warning.includes('belum bisa dipetakan tegas ke pemohon/pasangan')));
});
