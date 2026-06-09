const test = require('node:test');
const assert = require('node:assert/strict');

const { checkCompleteness, checkAllCompleteness } = require('../../src/modules/bulk-processing/completeness.service');

const ALL_REQUIRED_DOC_TYPES = [
  'formulir_aplikasi_kredit',
  'pas_foto',
  'ktp',
  'kk',
  'npwp',
  'surat_pemesanan_rumah',
  'pas_foto_pasangan',
  'ktp_pasangan',
  'npwp_pasangan',
  'rekening_koran',
  'slip_gaji',
  'nib',
  'laporan_keuangan_usaha',
  'dokumen_informasi_usaha',
];

test('checkCompleteness reports all required items missing for empty documents', () => {
  const completeness = checkCompleteness([]);

  assert.equal(completeness.totalRequired, 15);
  assert.equal(completeness.foundRequired, 0);
  assert.equal(completeness.score, 0);
  assert.ok(completeness.missing.includes('KTP Pemohon'));
  assert.ok(completeness.missing.includes('KTP Pasangan'));
  assert.ok(completeness.missing.includes('Slip Gaji / Surat Keterangan Penghasilan'));
});

test('checkCompleteness reaches full score when all required document types are present', () => {
  const completeness = checkCompleteness(ALL_REQUIRED_DOC_TYPES);

  assert.equal(completeness.totalRequired, 15);
  assert.equal(completeness.foundRequired, 15);
  assert.equal(completeness.score, 1);
  assert.deepEqual(completeness.missing, []);
});

test('optional documents do not change required completeness score', () => {
  const withoutOptional = checkCompleteness(['ktp']);
  const withOptional = checkCompleteness(['ktp', 'akta_nikah', 'spt_pajak']);

  assert.equal(withoutOptional.score, withOptional.score);
  assert.equal(withOptional.categories.data_pasangan.items.find((item) => item.type === 'akta_nikah').status, 'found');
  assert.equal(withOptional.categories.dokumen_pendukung.items.find((item) => item.type === 'spt_pajak').status, 'found');
});

test('checkAllCompleteness maps document ids safely and ignores unknown ids', () => {
  const result = checkAllCompleteness(
    [
      { id: 'nasabah-1', documentIds: ['doc-1', 'missing-doc'] },
      { id: 'nasabah-2', documentIds: ['doc-2'] },
    ],
    [
      { id: 'doc-1', documentType: 'ktp' },
      { id: 'doc-2', documentType: 'npwp' },
    ]
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].nasabahId, 'nasabah-1');
  assert.ok(result[0].completeness.missing.includes('Pas Foto Pemohon'));
  assert.equal(result[1].nasabahId, 'nasabah-2');
  assert.ok(result[1].completeness.missing.includes('KTP Pemohon'));
});
