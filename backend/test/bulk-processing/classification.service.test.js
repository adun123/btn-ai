const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyTextMulti,
  extractIdentifiers,
  classifyAndGroupPages,
} = require('../../src/modules/bulk-processing/classification.service');

test('classifyTextMulti returns unknown for empty OCR text', () => {
  const result = classifyTextMulti('   ');

  assert.deepEqual(result, [{
    documentType: 'unknown',
    confidence: 0,
    method: 'empty_text',
    matchedKeywords: [],
  }]);
});

test('classifyTextMulti detects multiple document types on one OCR page', () => {
  const text = [
    'KARTU TANDA PENDUDUK',
    'NIK: 3173010101010001',
    'Berlaku Hingga: SEUMUR HIDUP',
    'NPWP',
    'Nomor Pokok Wajib Pajak',
    '12.345.678.9-012.345',
    'Direktorat Jenderal Pajak',
  ].join('\n');

  const types = classifyTextMulti(text).map((item) => item.documentType);

  assert.ok(types.includes('ktp'));
  assert.ok(types.includes('npwp'));
});

test('extractIdentifiers pulls key KTP fields from OCR text', () => {
  const text = [
    'KARTU TANDA PENDUDUK',
    'NIK: 3173010101010001',
    'Nama: JOHN DOE',
    'Tempat/Tgl Lahir: JAKARTA, 01-01-1990',
    'Alamat: JL MAWAR 123',
    'Status Perkawinan: KAWIN',
    'Pekerjaan: KARYAWAN SWASTA',
  ].join('\n');

  const fields = extractIdentifiers(text, 'ktp');

  assert.equal(fields.nik, '3173010101010001');
  assert.equal(fields.nama, 'JOHN DOE');
  assert.equal(fields.statusPerkawinan, 'KAWIN');
  assert.equal(fields.pekerjaan, 'KARYAWAN SWASTA');
  assert.equal(fields.alamat, 'JL MAWAR 123');
});

test('classifyAndGroupPages merges consecutive pages of the same document and backfills missing fields', () => {
  const pages = [
    {
      pageId: 'page-1',
      sourceFilename: 'ktp-john.pdf',
      pageNumber: 1,
      ocrText: [
        'KARTU TANDA PENDUDUK',
        'NIK: 3173010101010001',
        'Nama: JOHN DOE',
        'Alamat: JL MAWAR 123',
      ].join('\n'),
    },
    {
      pageId: 'page-2',
      sourceFilename: 'ktp-john.pdf',
      pageNumber: 2,
      ocrText: [
        'KARTU TANDA PENDUDUK',
        'Status Perkawinan: KAWIN',
        'Pekerjaan: KARYAWAN SWASTA',
      ].join('\n'),
    },
  ];

  const documents = classifyAndGroupPages(pages);
  const ktpDocument = documents.find((document) => document.documentType === 'ktp');

  assert.ok(ktpDocument);
  assert.deepEqual(ktpDocument.pageIds, ['page-1', 'page-2']);
  assert.equal(ktpDocument.extractedFields.nik, '3173010101010001');
  assert.equal(ktpDocument.extractedFields.nama, 'JOHN DOE');
  assert.equal(ktpDocument.extractedFields.alamat, 'JL MAWAR 123');
  assert.equal(ktpDocument.extractedFields.statusPerkawinan, 'KAWIN');
  assert.equal(ktpDocument.extractedFields.pekerjaan, 'KARYAWAN SWASTA');
});
