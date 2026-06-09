const test = require('node:test');
const assert = require('node:assert/strict');

const {
  groupByNasabah,
  normalizeName,
  calculateSimilarity,
} = require('../../src/modules/bulk-processing/grouping.service');

test('groupByNasabah keeps same-file docs with one identity in one group', () => {
  const groups = groupByNasabah([
    {
      id: 'doc-1',
      documentType: 'ktp',
      sourceFilename: 'john.pdf',
      extractedFields: { nik: '3173010101010001', nama: 'John Doe', alamat: 'Jakarta' },
    },
    {
      id: 'doc-2',
      documentType: 'npwp',
      sourceFilename: 'john.pdf',
      extractedFields: { nama: 'John Doe' },
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].nik, '3173010101010001');
  assert.equal(groups[0].fullName, 'John Doe');
  assert.deepEqual(groups[0].documentIds.sort(), ['doc-1', 'doc-2']);
});

test('groupByNasabah splits same-file docs when multiple distinct NIKs are found', () => {
  const groups = groupByNasabah([
    {
      id: 'doc-1',
      documentType: 'ktp',
      sourceFilename: 'mixed.pdf',
      extractedFields: { nik: '3173010101010001', nama: 'John Doe' },
    },
    {
      id: 'doc-2',
      documentType: 'ktp',
      sourceFilename: 'mixed.pdf',
      extractedFields: { nik: '3173010101010002', nama: 'Jane Doe' },
    },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.nik).sort(), ['3173010101010001', '3173010101010002']);
});

test('groupByNasabah merges cross-file docs by fuzzy name when NIK is absent', () => {
  const groups = groupByNasabah([
    {
      id: 'doc-1',
      documentType: 'slip_gaji',
      sourceFilename: 'slip.pdf',
      extractedFields: { nama: 'BUDI SANTOSO' },
    },
    {
      id: 'doc-2',
      documentType: 'rekening_koran',
      sourceFilename: 'rekening.pdf',
      extractedFields: { nama: 'Budi Santoso' },
    },
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].documentIds.sort(), ['doc-1', 'doc-2']);
});

test('normalizeName and calculateSimilarity support fuzzy matching', () => {
  assert.equal(normalizeName('Budi, Santoso!!'), 'budi santoso');
  assert.equal(calculateSimilarity('budi santoso', 'budi santoso'), 1);
  assert.ok(calculateSimilarity('budi santoso', 'budi santosa') >= 0.8);
});
